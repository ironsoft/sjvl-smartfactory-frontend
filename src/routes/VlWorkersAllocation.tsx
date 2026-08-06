import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Center,
  Collapse,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  useColorModeValue,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { FaChevronDown, FaChevronRight, FaSearch, FaTimes } from "react-icons/fa";
import {
  createWorkerAllocationAssignment,
  getUnassignedWorkerGroups,
  getUnassignedWorkers,
  getWorkerAllocationLines,
  IUnassignedWorkerGroup,
  IWorkerAllocationAssignment,
  IWorkerAllocationLine,
  IWorkerAllocationSjNo,
  IWorkerListItem,
  unassignWorkerAllocation,
} from "../api";

const UNASSIGNED_LINE_LABEL = "라인 미지정";

const FACTORY_OPTIONS = [
  { value: "VL", label: "VL Factory" },
  { value: "TG", label: "TG Factory" },
  { value: "BD", label: "BD Factory" },
];

// SJ No 배지에는 "이 SJ No에 실제로(고유하게) 배치된 인원"만 센다 — 미러링(복사됨)으로
// 보여지는 인원까지 세면 라인의 다른 SJ No 인원과 겹쳐서 사실상 항상 라인 총원과 같아져
// 의미가 없어진다. 미러링 인원은 배지가 아니라 "복사됨" 칩 자체로 확인한다.
function sjNoAssignedCount(sjNo: IWorkerAllocationSjNo): number {
  return sjNo.assignments.length + sjNo.modules.reduce((sum, m) => sum + m.assignments.length, 0);
}

// 이 SJ No의 "공통"에 미러링(복사)되어 보여야 할 인원 = 라인 전체 로스터 중, 이 SJ No
// 자신에게 실제로 배치되지 않은 사람 전부. 즉 아직 아무 데도 안 정해진 사람(라인 공통)뿐
// 아니라 "다른" SJ No/모듈에 배치된 사람도 여기서는 계속 후보로 보인다 — 오직 자기 자신이
// 실제로 속한 SJ No에서만 미러링이 빠진다.
function sjNoMirroredAssignments(
  line: IWorkerAllocationLine,
  sjNo: IWorkerAllocationSjNo
): IWorkerAllocationAssignment[] {
  return lineRoster(line).filter((a) => a.vl_assembly_sj_no !== sjNo.pk);
}

function totalAssignedCount(line: IWorkerAllocationLine): number {
  return (
    line.assignments.length +
    line.sj_nos.reduce((sum, s) => sum + s.assignments.length + s.modules.reduce((n, m) => n + m.assignments.length, 0), 0)
  );
}

// 라인 공통 = "이 라인에서 배분할 대상 전원" — 아직 세부 배치가 안 된 사람뿐 아니라, 이미
// 특정 SJ No/모듈로 세부 배치된 사람도 계속 여기 포함되어야 한다(요청 사항). SJ No 공통
// 미러링과 달리, 여기서는 한 번 세부 배치되어도 사라지지 않는다.
function lineRoster(line: IWorkerAllocationLine): IWorkerAllocationAssignment[] {
  return [
    ...line.assignments,
    ...line.sj_nos.flatMap((s) => [...s.assignments, ...s.modules.flatMap((m) => m.assignments)]),
  ];
}

function WorkerCard({ worker }: { worker: IWorkerListItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `worker-${worker.pk}`,
    data: { worker, origin: "pool" },
  });
  const cardBg = useColorModeValue("white", "gray.700");
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <HStack
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      p={2}
      borderWidth="1px"
      borderRadius="md"
      bg={cardBg}
      opacity={isDragging ? 0.4 : 1}
      cursor="grab"
      spacing={3}
      align="center"
    >
      <Avatar size="sm" name={worker.name} src={worker.avatar ?? undefined} />
      <VStack align="flex-start" spacing={0}>
        <HStack spacing={1}>
          <Text fontSize="sm" fontWeight="semibold">
            {worker.name}
          </Text>
          {worker.is_manager && (
            <Badge fontSize="0.6rem" colorScheme="purple">
              라인 리더
            </Badge>
          )}
        </HStack>
        <Text fontSize="xs" color="gray.500">
          {[worker.department?.name, worker.position?.name].filter(Boolean).join(" · ") || "-"}
        </Text>
      </VStack>
    </HStack>
  );
}

// 이미 배정된 사람을 나타내는 칩 — 드래그로 다른 곳(모듈 등)에 다시 배정할 수 있다.
// mirrored=true면 라인 공통에서 자동으로 복사되어 보이는 인스턴스로, 해제 버튼을 숨긴다
// (실제 배정 레코드는 하나뿐이므로, 해제는 항상 "라인 공통" 쪽에서만 하도록 유도).
function AssignedChip({
  dragId,
  assignment,
  onUnassign,
  mirrored = false,
  showLocation = false,
}: {
  dragId: string;
  assignment: IWorkerAllocationAssignment;
  onUnassign: (pk: number) => void;
  mirrored?: boolean;
  showLocation?: boolean;
}) {
  const locationLabel = assignment.module_code
    ? `${assignment.sj_no ?? ""} · ${assignment.module_code}`
    : assignment.sj_no ?? null;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { worker: assignment.worker_detail, origin: "assigned" },
  });
  const chipBg = useColorModeValue("gray.100", "gray.600");
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <HStack
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      spacing={1}
      bg={chipBg}
      borderRadius="full"
      pl={1}
      pr={1}
      py={1}
      cursor="grab"
      opacity={isDragging ? 0.4 : mirrored ? 0.75 : 1}
      borderWidth={mirrored || assignment.worker_detail.is_manager ? "1px" : undefined}
      borderStyle={mirrored ? "dashed" : "solid"}
      borderColor={mirrored ? "gray.400" : assignment.worker_detail.is_manager ? "purple.400" : undefined}
    >
      <Avatar size="xs" name={assignment.worker_detail.name} src={assignment.worker_detail.avatar ?? undefined} />
      <Text fontSize="xs" fontWeight={assignment.worker_detail.is_manager ? "bold" : "normal"}>
        {assignment.worker_detail.is_manager ? "★ " : ""}
        {assignment.worker_detail.name}
      </Text>
      {showLocation && locationLabel && (
        <Badge fontSize="0.55rem" colorScheme="blue" borderRadius="full">
          {locationLabel}
        </Badge>
      )}
      {mirrored ? (
        <Badge fontSize="0.55rem" colorScheme="gray" borderRadius="full">
          복사됨
        </Badge>
      ) : (
        <IconButton
          aria-label="unassign"
          icon={<FaTimes />}
          size="xs"
          variant="ghost"
          onClick={() => onUnassign(assignment.pk)}
        />
      )}
    </HStack>
  );
}

function DropZone({
  id,
  assignments,
  onUnassign,
  placeholder = "여기로 작업자를 드래그하세요",
  showLocation = false,
}: {
  id: string;
  assignments: IWorkerAllocationAssignment[];
  onUnassign: (pk: number) => void;
  placeholder?: string;
  showLocation?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const idleBorder = useColorModeValue("gray.200", "gray.600");
  const overBg = useColorModeValue("blue.50", "blue.900");

  return (
    <Box
      ref={setNodeRef}
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={isOver ? "blue.400" : idleBorder}
      borderRadius="md"
      p={3}
      minH="60px"
      bg={isOver ? overBg : "transparent"}
      transition="all 0.15s"
    >
      {assignments.length === 0 ? (
        <Text fontSize="xs" color="gray.400">
          {placeholder}
        </Text>
      ) : (
        <Wrap spacing={2}>
          {[...assignments]
            .sort((a, b) => Number(b.worker_detail.is_manager) - Number(a.worker_detail.is_manager))
            .map((a) => (
              <WrapItem key={a.pk}>
                <AssignedChip
                  // dnd-kit 드래그 id는 페이지 전체에서 유일해야 한다 — 같은 배정 레코드(a.pk)가
                  // "라인 공통"(전체 로스터)과 그 실제 소속 위치(모듈 등) 두 군데에 동시에 렌더링될
                  // 수 있으므로, 이 DropZone 자신의 id(예: line-3, module-14)를 붙여 구분한다.
                  // 그렇지 않으면 두 칩이 같은 id를 공유해 dnd-kit이 드래그 대상을 혼동하고,
                  // 엉뚱한(다른 SJ No의) 배정이 사라지는 버그로 이어진다.
                  dragId={`assigned-${a.pk}-at-${id}`}
                  assignment={a}
                  onUnassign={onUnassign}
                  showLocation={showLocation}
                />
              </WrapItem>
            ))}
        </Wrap>
      )}
    </Box>
  );
}

// SJ No "공통" 영역 — 더 이상 직접 드롭 대상이 아니다. 라인 공통 인원이 자동으로 복사되어
// 보이고(점선 테두리 · "복사됨" 배지), 여기서 각 모듈로 드래그해서 세부 배정한다. 일단 특정
// 모듈로 배정되면 그 사람의 실제 배정 레코드가 모듈을 가리키게 되어 여기서는 자연히 사라진다.
function SjNoCommonDisplay({
  sjNo,
  mirroredAssignments,
  onUnassign,
}: {
  sjNo: IWorkerAllocationSjNo;
  mirroredAssignments: IWorkerAllocationAssignment[];
  onUnassign: (pk: number) => void;
}) {
  const bg = useColorModeValue("gray.50", "gray.750");
  const hasAny = sjNo.assignments.length > 0 || mirroredAssignments.length > 0;

  return (
    <Box borderWidth="1px" borderStyle="dashed" borderColor="gray.300" borderRadius="md" p={3} minH="60px" bg={bg}>
      {!hasAny ? (
        <Text fontSize="xs" color="gray.400">
          라인 공통 인원이 있으면 자동으로 여기에 표시됩니다
        </Text>
      ) : (
        <Wrap spacing={2}>
          {sjNo.assignments.map((a) => (
            <WrapItem key={a.pk}>
              <AssignedChip dragId={`assigned-${a.pk}-at-sjno-${sjNo.pk}`} assignment={a} onUnassign={onUnassign} />
            </WrapItem>
          ))}
          {mirroredAssignments.map((a) => (
            <WrapItem key={`${a.pk}-mirror-${sjNo.pk}`}>
              <AssignedChip
                dragId={`assigned-${a.pk}-mirror-${sjNo.pk}`}
                assignment={a}
                onUnassign={onUnassign}
                mirrored
              />
            </WrapItem>
          ))}
        </Wrap>
      )}
    </Box>
  );
}

// 그룹(=Worker.line)을 펼쳤을 때만 그 그룹의 인원을 페이지 단위로 불러온다 —
// 공장당 수천 명 규모에서도 최초 로딩 시엔 그룹 카운트만 가져오므로 가볍다.
function WorkerGroupPanel({
  group,
  search,
  isOpen,
  onToggle,
}: {
  group: IUnassignedWorkerGroup;
  search: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const lineParam: number | "none" = group.line ?? "none";
  const { data, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["unassignedWorkers", lineParam, search],
    queryFn: ({ pageParam }) =>
      getUnassignedWorkers({ line: lineParam, search: search || undefined, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.next ? allPages.length + 1 : undefined),
    enabled: isOpen,
  });

  const loadedWorkers = data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
      <HStack justify="space-between" p={2} cursor="pointer" onClick={onToggle}>
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="semibold">
            {group.line_name ?? UNASSIGNED_LINE_LABEL}
          </Text>
          <Badge fontSize="0.65rem" borderRadius="full">
            {group.count}
          </Badge>
        </HStack>
        <IconButton
          aria-label="toggle group"
          size="xs"
          variant="ghost"
          icon={isOpen ? <FaChevronDown /> : <FaChevronRight />}
        />
      </HStack>
      <Collapse in={isOpen}>
        <VStack align="stretch" spacing={2} p={2} pt={0}>
          {loadedWorkers.map((w) => (
            <WorkerCard key={w.pk} worker={w} />
          ))}
          {isFetching && (
            <Center py={2}>
              <Spinner size="sm" />
            </Center>
          )}
          {!isFetching && hasNextPage && (
            <Button size="xs" variant="ghost" onClick={() => fetchNextPage()}>
              더 보기 ({loadedWorkers.length} / {group.count})
            </Button>
          )}
        </VStack>
      </Collapse>
    </Box>
  );
}

export default function VlWorkersAllocation() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [factory, setFactory] = useState("VL");
  const [selectedLinePk, setSelectedLinePk] = useState<number | "">("");
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({});
  const [expandedSjNos, setExpandedSjNos] = useState<Record<number, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeDragWorker, setActiveDragWorker] = useState<IWorkerListItem | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ["workerAllocationLines", factory],
    queryFn: () => getWorkerAllocationLines(factory),
  });

  const filteredLines = useMemo(() => {
    if (selectedLinePk === "") return lines ?? [];
    return (lines ?? []).filter((l) => l.pk === selectedLinePk);
  }, [lines, selectedLinePk]);

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["unassignedWorkerGroups", debouncedSearch],
    queryFn: () => getUnassignedWorkerGroups(debouncedSearch || undefined),
  });
  const groups = groupsData?.results ?? [];
  const totalUnassigned = groupsData?.total ?? 0;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const moduleToLine = useMemo(() => {
    const moduleToLineMap = new Map<number, number>();
    (lines ?? []).forEach((line) => {
      line.sj_nos.forEach((s) => {
        s.modules.forEach((m) => moduleToLineMap.set(m.pk, line.pk));
      });
    });
    return moduleToLineMap;
  }, [lines]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workerAllocationLines"] });
    await queryClient.invalidateQueries({ queryKey: ["unassignedWorkerGroups"] });
    await queryClient.invalidateQueries({ queryKey: ["unassignedWorkers"] });
  };

  const handleAssign = async (
    workerId: number,
    productionLine: number,
    opts?: { vlModule?: number }
  ) => {
    try {
      await createWorkerAllocationAssignment({
        worker: workerId,
        production_line: productionLine,
        vl_assembly_module: opts?.vlModule ?? null,
      });
      await invalidate();
    } catch {
      toast({ title: "배정 실패", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleUnassign = async (assignmentPk: number) => {
    try {
      await unassignWorkerAllocation(assignmentPk);
      await invalidate();
    } catch {
      toast({ title: "배정 해제 실패", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const worker = event.active.data.current?.worker as IWorkerListItem | undefined;
    setActiveDragWorker(worker ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragWorker(null);
    const { active, over } = event;
    if (!over) return;
    const worker = active.data.current?.worker as IWorkerListItem | undefined;
    const origin = active.data.current?.origin as "pool" | "assigned" | undefined;
    if (!worker) return;
    const workerId = worker.pk;
    const overId = String(over.id);

    if (overId.startsWith("module-")) {
      // 미배정 풀은 라인 공통으로만 드래그할 수 있다 — 모듈로 바로 배정하는 건 막는다.
      if (origin === "pool") return;
      const modulePk = Number(overId.replace("module-", ""));
      const linePk = moduleToLine.get(modulePk);
      if (linePk) void handleAssign(workerId, linePk, { vlModule: modulePk });
    } else if (overId.startsWith("line-")) {
      const linePk = Number(overId.replace("line-", ""));
      void handleAssign(workerId, linePk);
    }
  };

  if (linesLoading || groupsLoading) {
    return (
      <Center py={20}>
        <Spinner size="lg" />
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>{factory} Workers Allocation</title>
      </Helmet>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Box px={{ base: "4", md: "8", lg: "12" }} py={{ base: "6", md: "8" }}>
          <HStack justify="space-between" mb={6} flexWrap="wrap" rowGap={2}>
            <Heading size="md">{factory} Workers Allocation</Heading>
            <Select
              size="sm"
              maxW="180px"
              value={factory}
              onChange={(e) => {
                setFactory(e.target.value);
                setSelectedLinePk("");
                setExpandedLines({});
              }}
            >
              {FACTORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </HStack>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="start">
            <VStack align="stretch" spacing={4}>
              <Heading size="sm" color="gray.500">
                Production Lines ({filteredLines.length}{selectedLinePk !== "" ? ` / ${(lines ?? []).length}` : ""})
              </Heading>
              <Select
                size="sm"
                value={selectedLinePk}
                onChange={(e) => setSelectedLinePk(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">전체 라인 보기</option>
                {(lines ?? []).map((line) => (
                  <option key={line.pk} value={line.pk}>
                    {line.name}
                  </option>
                ))}
              </Select>
              {filteredLines.map((line) => (
                <Card key={line.pk} variant="outline">
                  <CardHeader pb={2}>
                    <HStack justify="space-between">
                      <HStack spacing={2}>
                        <Heading size="sm">{line.name}</Heading>
                        <Badge colorScheme={totalAssignedCount(line) > 0 ? "blue" : "gray"} borderRadius="full" fontSize="0.65rem">
                          {totalAssignedCount(line)} MP
                        </Badge>
                      </HStack>
                      {line.sj_nos.length > 0 && (
                        <IconButton
                          aria-label="toggle sj nos"
                          size="xs"
                          variant="ghost"
                          icon={expandedLines[line.pk] ? <FaChevronDown /> : <FaChevronRight />}
                          onClick={() =>
                            setExpandedLines((s) => ({ ...s, [line.pk]: !s[line.pk] }))
                          }
                        />
                      )}
                    </HStack>
                  </CardHeader>
                  <CardBody pt={0}>
                    <Text fontSize="xs" color="gray.400" mb={1}>
                      라인 공통 — 이 라인에서 배분할 대상 전원 (미배정 인원은 여기로만 드래그하세요)
                    </Text>
                    <DropZone
                      id={`line-${line.pk}`}
                      assignments={lineRoster(line)}
                      onUnassign={handleUnassign}
                      placeholder="여기로 작업자를 드래그하면 라인 전체 + 모든 SJ No 공통에 자동으로 반영됩니다"
                      showLocation
                    />
                    {line.sj_nos.length > 0 && (
                      <Collapse in={!!expandedLines[line.pk]}>
                        <VStack align="stretch" spacing={3} mt={3} pl={4} borderLeftWidth="2px">
                          {line.sj_nos.map((s) => (
                            <Box key={s.pk}>
                              <HStack justify="space-between" mb={1}>
                                <HStack spacing={2}>
                                  <Badge colorScheme="teal">{s.sj_no}</Badge>
                                  <Badge fontSize="0.6rem" borderRadius="full">
                                    {sjNoAssignedCount(s)} MP
                                  </Badge>
                                </HStack>
                                {s.modules.length > 0 && (
                                  <IconButton
                                    aria-label="toggle modules"
                                    size="xs"
                                    variant="ghost"
                                    icon={expandedSjNos[s.pk] ? <FaChevronDown /> : <FaChevronRight />}
                                    onClick={() =>
                                      setExpandedSjNos((prev) => ({ ...prev, [s.pk]: !prev[s.pk] }))
                                    }
                                  />
                                )}
                              </HStack>
                              <SjNoCommonDisplay
                                sjNo={s}
                                mirroredAssignments={sjNoMirroredAssignments(line, s)}
                                onUnassign={handleUnassign}
                              />
                              {s.modules.length > 0 && (
                                <Collapse in={!!expandedSjNos[s.pk]}>
                                  <VStack align="stretch" spacing={3} mt={3} pl={4} borderLeftWidth="2px">
                                    {s.modules.map((m) => (
                                      <Box key={m.pk}>
                                        <Badge colorScheme="purple" mb={1}>
                                          {m.code}
                                        </Badge>
                                        <DropZone
                                          id={`module-${m.pk}`}
                                          assignments={m.assignments}
                                          onUnassign={handleUnassign}
                                          placeholder="SJ No 공통에서 이 모듈로 드래그하세요"
                                        />
                                      </Box>
                                    ))}
                                  </VStack>
                                </Collapse>
                              )}
                            </Box>
                          ))}
                        </VStack>
                      </Collapse>
                    )}
                  </CardBody>
                </Card>
              ))}
              {filteredLines.length === 0 && (
                <Text color="gray.400" fontSize="sm">
                  {`등록된 ${factory} 생산라인이 없습니다.`}
                </Text>
              )}
            </VStack>

            <VStack align="stretch" spacing={3}>
              <Heading size="sm" color="gray.500">
                미배정 인원 ({totalUnassigned})
              </Heading>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none">
                  <FaSearch color="var(--chakra-colors-gray-400)" />
                </InputLeftElement>
                <Input
                  placeholder="이름, 사번으로 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
              {groups.map((group) => {
                const key = String(group.line ?? "none");
                const isOpen = !!debouncedSearch || !!expandedGroups[key];
                return (
                  <WorkerGroupPanel
                    key={key}
                    group={group}
                    search={debouncedSearch}
                    isOpen={isOpen}
                    onToggle={() => setExpandedGroups((s) => ({ ...s, [key]: !s[key] }))}
                  />
                );
              })}
              {groups.length === 0 && (
                <Text fontSize="sm" color="gray.400">
                  {debouncedSearch ? "검색 결과가 없습니다." : "미배정 인원이 없습니다."}
                </Text>
              )}
            </VStack>
          </SimpleGrid>
        </Box>

        <DragOverlay>
          {activeDragWorker ? (
            <HStack
              p={2}
              borderWidth="1px"
              borderRadius="md"
              bg="white"
              boxShadow="lg"
              spacing={3}
            >
              <Avatar
                size="sm"
                name={activeDragWorker.name}
                src={activeDragWorker.avatar ?? undefined}
              />
              <Text fontSize="sm" fontWeight="semibold">
                {activeDragWorker.name}
              </Text>
            </HStack>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
