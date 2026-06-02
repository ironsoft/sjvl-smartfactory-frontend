import {
  Box,
  Text,
  Badge,
  useColorModeValue,
  HStack,
  VStack,
  Divider,
  Button,
  Spinner,
  Center,
  useToast,
  Input,
  Textarea,
  Select,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Avatar,
  Grid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  Image,
  Heading,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import {
  getWorkerDetail, editWorker, deleteWorker,
  getJobDuties, getWorkerDepartments, getWorkerSections,
  getWorkerPositions, getWorkerRanks, getWorkerTeams,
  getWorkerFactories, getWorkerCountries, getWorkerLines,
  IWorkerDetail, IJobDuties,
  IWorkerDept, IWorkerSection, IWorkerPosition, IWorkerRank,
  IWorkerTeam, IWorkerFactory, IWorkerCountry, IWorkerLine,
} from "../api";
import { useTranslation } from "react-i18next";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay, formatIsoDateTimeDisplay } from "../lib/dateLocale";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>{label}</Text>
      <Box>{children}</Box>
    </Box>
  );
}

type EditForm = {
  company_id: string; name: string; nick_name: string; gender: string;
  bio: string; birthdate: string; start_career_date: string;
  pervieous_company: string; joined_at_company: string; joined_at_factory: string;
  is_resigned: string; resigned_date: string; is_indirect: string;
  job_title: string; job_description: string; remark: string;
  nationality: number | null; factory: number | null; department: number | null;
  section: number | null; line: number | null; position: number | null;
  rank: number | null; team: number | null; job_duties: number | null;
};

export default function SjWorkerDetail() {
  const { workerId } = useParams<{ workerId: string }>();
  const pk = Number(workerId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);
  const fmtDateTime = (d?: string | null) => formatIsoDateTimeDisplay(d, i18n.language);

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const sectionBg = useColorModeValue("gray.50", "gray.700");

  const { data: worker, isLoading } = useQuery<IWorkerDetail>({
    queryKey: ["workerDetail", pk],
    queryFn: () => getWorkerDetail(pk),
    enabled: !!pk,
  });

  // Meta lists (편집 시 사용)
  const [metaEnabled, setMetaEnabled] = useState(false);
  const { data: jobDutiesList = [] } = useQuery<IJobDuties[]>({ queryKey: ["jobDuties"], queryFn: getJobDuties, enabled: metaEnabled });
  const { data: departments = [] } = useQuery<IWorkerDept[]>({ queryKey: ["wDepts"], queryFn: getWorkerDepartments, enabled: metaEnabled });
  const { data: sections = [] } = useQuery<IWorkerSection[]>({ queryKey: ["wSections"], queryFn: getWorkerSections, enabled: metaEnabled });
  const { data: positions = [] } = useQuery<IWorkerPosition[]>({ queryKey: ["wPositions"], queryFn: getWorkerPositions, enabled: metaEnabled });
  const { data: ranks = [] } = useQuery<IWorkerRank[]>({ queryKey: ["wRanks"], queryFn: getWorkerRanks, enabled: metaEnabled });
  const { data: teams = [] } = useQuery<IWorkerTeam[]>({ queryKey: ["wTeams"], queryFn: getWorkerTeams, enabled: metaEnabled });
  const { data: factories = [] } = useQuery<IWorkerFactory[]>({ queryKey: ["wFactories"], queryFn: getWorkerFactories, enabled: metaEnabled });
  const { data: countries = [] } = useQuery<IWorkerCountry[]>({ queryKey: ["wCountries"], queryFn: getWorkerCountries, enabled: metaEnabled });
  const { data: lines = [] } = useQuery<IWorkerLine[]>({ queryKey: ["wLines"], queryFn: getWorkerLines, enabled: metaEnabled });

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    if (!worker) return;
    setMetaEnabled(true);
    setForm({
      company_id: worker.company_id ?? "",
      name: worker.name,
      nick_name: worker.nick_name ?? "",
      gender: worker.gender ?? "",
      bio: worker.bio ?? "",
      birthdate: worker.birthdate ?? "",
      start_career_date: worker.start_career_date ?? "",
      pervieous_company: worker.pervieous_company ?? "",
      joined_at_company: worker.joined_at_company ?? "",
      joined_at_factory: worker.joined_at_factory ?? "",
      is_resigned: worker.is_resigned ?? "",
      resigned_date: worker.resigned_date ?? "",
      is_indirect: worker.is_indirect ?? "",
      job_title: worker.job_title ?? "",
      job_description: worker.job_description ?? "",
      remark: worker.remark ?? "",
      nationality: worker.nationality,
      factory: worker.factory,
      department: worker.department,
      section: worker.section,
      line: worker.line,
      position: worker.position,
      rank: worker.rank,
      team: worker.team,
      job_duties: worker.job_duties,
    });
    setIsEditing(true);
  };

  const s = (key: keyof EditForm) => (form ? (form[key] as string) ?? "" : "");
  const n = (key: keyof EditForm) => (form ? (form[key] as number | null) : null);

  const handleSave = async () => {
    if (!form) return;
    setIsSaving(true);
    try {
      const payload: any = { ...form };
      // empty string → null for nullable fields
      ["birthdate", "start_career_date", "joined_at_company", "joined_at_factory",
       "resigned_date", "gender", "is_resigned", "is_indirect"].forEach((key) => {
        if (payload[key] === "") payload[key] = null;
      });
      await editWorker(pk, payload);
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["workerDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      setIsEditing(false);
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteWorker(pk);
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      navigate("/workers");
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
      setIsDeleting(false);
    }
  };

  const { isOpen: isAvatarOpen, onOpen: onAvatarOpen, onClose: onAvatarClose } = useDisclosure();

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!worker) return <Center minH="60vh"><Text color="gray.400">Worker not found.</Text></Center>;

  const fkSelect = (
    label: string,
    key: keyof EditForm,
    items: { pk: number; name: string | null }[],
    displayVal: string | null | undefined
  ) => (
    <InfoRow label={label}>
      {isEditing && form
        ? <Select size="sm" value={n(key) ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value ? Number(e.target.value) : null })} placeholder="-- None --">
            {items.map((item) => <option key={item.pk} value={item.pk}>{item.name}</option>)}
          </Select>
        : <Text fontSize="sm">{displayVal || "-"}</Text>}
    </InfoRow>
  );

  return (
    <>
      <Helmet><title>{worker.name}</title></Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="4xl" mx="auto">

          <HStack mb={4}>
            <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>Back</Button>
          </HStack>

          <Box position="relative">
            <HStack position="absolute" top={-10} right={0} spacing={2}>
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>Save</Button>
                </>
              ) : (
                <>
                  <Button size="sm" leftIcon={<FaEdit />} variant="ghost" onClick={startEdit}>Edit</Button>
                  <Button size="sm" leftIcon={<FaTrash />} variant="ghost" colorScheme="red" onClick={onDeleteOpen}>Delete</Button>
                </>
              )}
            </HStack>

            <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">

              {/* 상단: 아바타 + 기본 정보 */}
              <HStack align="flex-start" spacing={6} mb={6}>
                <Avatar size="2xl" name={worker.name} src={worker.avatar ?? undefined}
                  cursor={worker.avatar ? "zoom-in" : "default"}
                  onClick={worker.avatar ? onAvatarOpen : undefined}
                  _hover={worker.avatar ? { opacity: 0.85 } : {}} />
                <VStack align="stretch" spacing={2} flex={1}>
                  {isEditing && form
                    ? <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fontWeight="bold" fontSize="xl" />
                    : <Heading size="lg">{worker.name}</Heading>}
                  {isEditing && form
                    ? <Input value={form.nick_name} onChange={(e) => setForm({ ...form, nick_name: e.target.value })} placeholder="Nick name" size="sm" />
                    : worker.nick_name && <Text color="gray.500">{worker.nick_name}</Text>}
                  <HStack spacing={2} flexWrap="wrap">
                    {worker.department_detail && <Badge colorScheme="purple">{worker.department_detail.name}</Badge>}
                    {worker.section_detail && <Badge colorScheme="cyan">{worker.section_detail.name}</Badge>}
                    {worker.position_detail && <Badge colorScheme="blue">{worker.position_detail.name}</Badge>}
                    {worker.rank_detail && <Badge colorScheme="orange">{worker.rank_detail.name}</Badge>}
                    {worker.job_duties_detail && <Badge colorScheme="green">{worker.job_duties_detail.name}</Badge>}
                    <Badge colorScheme={worker.is_resigned === "resigned" ? "red" : "green"}>
                      {worker.is_resigned === "resigned" ? "Resigned" : "Active"}
                    </Badge>
                  </HStack>
                </VStack>
              </HStack>

              <Divider mb={5} />

              {/* 개인 정보 */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Personal Info</Text>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <InfoRow label="COMPANY ID">
                    {isEditing && form
                      ? <Input size="sm" value={s("company_id")} onChange={(e) => setForm({ ...form, company_id: e.target.value })} />
                      : <Text fontSize="sm">{worker.company_id || "-"}</Text>}
                  </InfoRow>
                  <InfoRow label="GENDER">
                    {isEditing && form
                      ? <Select size="sm" value={s("gender")} onChange={(e) => setForm({ ...form, gender: e.target.value })} placeholder="-- select --">
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </Select>
                      : <Text fontSize="sm">{worker.gender || "-"}</Text>}
                  </InfoRow>
                  <InfoRow label="BIRTHDATE">
                    {isEditing && form
                      ? <LocalizedDateInput size="sm" value={s("birthdate")} onChange={(v) => setForm({ ...form, birthdate: v })} />
                      : <Text fontSize="sm">{fmtDate(worker.birthdate)}{worker.age != null ? ` (${worker.age})` : ""}</Text>}
                  </InfoRow>
                  {fkSelect("NATIONALITY", "nationality", countries, worker.nationality_detail?.name)}
                </Grid>
                <Box mt={4}>
                  <InfoRow label="BIO">
                    {isEditing && form
                      ? <Textarea size="sm" value={s("bio")} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={2} />
                      : <Text fontSize="sm" whiteSpace="pre-wrap">{worker.bio || "-"}</Text>}
                  </InfoRow>
                </Box>
              </Box>

              {/* 경력 정보 */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Career</Text>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <InfoRow label="START CAREER DATE">
                    {isEditing && form
                      ? <LocalizedDateInput size="sm" value={s("start_career_date")} onChange={(v) => setForm({ ...form, start_career_date: v })} />
                      : <Text fontSize="sm">{fmtDate(worker.start_career_date)}{worker.experience_career ? ` (${worker.experience_career})` : ""}</Text>}
                  </InfoRow>
                  <InfoRow label="PREVIOUS COMPANY">
                    {isEditing && form
                      ? <Input size="sm" value={s("pervieous_company")} onChange={(e) => setForm({ ...form, pervieous_company: e.target.value })} />
                      : <Text fontSize="sm">{worker.pervieous_company || "-"}</Text>}
                  </InfoRow>
                  <InfoRow label="JOINED COMPANY">
                    {isEditing && form
                      ? <LocalizedDateInput size="sm" value={s("joined_at_company")} onChange={(v) => setForm({ ...form, joined_at_company: v })} />
                      : <Text fontSize="sm">{fmtDate(worker.joined_at_company)}{worker.experience_at_company ? ` (${worker.experience_at_company})` : ""}</Text>}
                  </InfoRow>
                  <InfoRow label="JOINED FACTORY">
                    {isEditing && form
                      ? <LocalizedDateInput size="sm" value={s("joined_at_factory")} onChange={(v) => setForm({ ...form, joined_at_factory: v })} />
                      : <Text fontSize="sm">{fmtDate(worker.joined_at_factory)}{worker.experience_at_factory ? ` (${worker.experience_at_factory})` : ""}</Text>}
                  </InfoRow>
                </Grid>
              </Box>

              {/* 직무 정보 */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Work Info</Text>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  {fkSelect("FACTORY", "factory", factories.map(f => ({ pk: f.pk, name: f.nickname || f.name })), worker.factory_detail ? (worker.factory_detail.nickname || worker.factory_detail.name) : null)}
                  {fkSelect("DEPARTMENT", "department", departments, worker.department_detail?.name)}
                  {fkSelect("SECTION", "section", sections, worker.section_detail?.name)}
                  {fkSelect("LINE", "line", lines, worker.line_detail?.name)}
                  {fkSelect("POSITION", "position", positions, worker.position_detail?.name)}
                  {fkSelect("RANK", "rank", ranks, worker.rank_detail?.name)}
                  {fkSelect("TEAM", "team", teams, worker.team_detail?.name)}
                  {fkSelect("JOB DUTIES", "job_duties", jobDutiesList, worker.job_duties_detail?.name)}
                  <InfoRow label="JOB TITLE">
                    {isEditing && form
                      ? <Input size="sm" value={s("job_title")} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                      : <Text fontSize="sm">{worker.job_title || "-"}</Text>}
                  </InfoRow>
                  <InfoRow label="INDIRECT">
                    {isEditing && form
                      ? <Select size="sm" value={s("is_indirect")} onChange={(e) => setForm({ ...form, is_indirect: e.target.value })} placeholder="-- select --">
                          <option value="indirect">Indirect</option>
                          <option value="not_indirect">Not Indirect</option>
                        </Select>
                      : <Text fontSize="sm">{worker.is_indirect || "-"}</Text>}
                  </InfoRow>
                </Grid>
                <Box mt={4}>
                  <InfoRow label="JOB DESCRIPTION">
                    {isEditing && form
                      ? <Textarea size="sm" value={s("job_description")} onChange={(e) => setForm({ ...form, job_description: e.target.value })} rows={2} />
                      : <Text fontSize="sm" whiteSpace="pre-wrap">{worker.job_description || "-"}</Text>}
                  </InfoRow>
                </Box>
              </Box>

              {/* 퇴직 */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Resignation</Text>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                  <InfoRow label="STATUS">
                    {isEditing && form
                      ? <Select size="sm" value={s("is_resigned")} onChange={(e) => setForm({ ...form, is_resigned: e.target.value })} placeholder="-- select --">
                          <option value="not_resigned">Active</option>
                          <option value="resigned">Resigned</option>
                        </Select>
                      : <Badge colorScheme={worker.is_resigned === "resigned" ? "red" : "green"}>
                          {worker.is_resigned === "resigned" ? "Resigned" : "Active"}
                        </Badge>}
                  </InfoRow>
                  <InfoRow label="RESIGNED DATE">
                    {isEditing && form
                      ? <LocalizedDateInput size="sm" value={s("resigned_date")} onChange={(v) => setForm({ ...form, resigned_date: v })} />
                      : <Text fontSize="sm">{fmtDate(worker.resigned_date)}</Text>}
                  </InfoRow>
                </Grid>
              </Box>

              {/* Remark */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <InfoRow label="REMARK">
                  {isEditing && form
                    ? <Textarea size="sm" value={s("remark")} onChange={(e) => setForm({ ...form, remark: e.target.value })} rows={3} />
                    : <Text fontSize="sm" whiteSpace="pre-wrap">{worker.remark || "-"}</Text>}
                </InfoRow>
              </Box>

              <Text fontSize="xs" color="gray.400">Created: {fmtDateTime(worker.created_at)}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Worker</AlertDialogHeader>
            <AlertDialogBody><strong>{worker.name}</strong>을(를) 삭제하시겠습니까?</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" ml={3} isLoading={isDeleting} onClick={handleDelete}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {worker.avatar && (
        <Modal isOpen={isAvatarOpen} onClose={onAvatarClose} size="md" isCentered>
          <ModalOverlay bg="blackAlpha.800" />
          <ModalContent bg="transparent" shadow="none">
            <ModalCloseButton color="white" />
            <ModalBody p={0}>
              <Image src={worker.avatar} alt={worker.name} borderRadius="lg" w="full" />
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
