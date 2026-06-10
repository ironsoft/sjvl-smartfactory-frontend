import {
  Badge,
  Box,
  Flex,
  HStack,
  Button,
  Text,
  Link,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  MenuGroup,
  IconButton,
  useDisclosure,
  useColorModeValue,
  useColorMode,
  useToast,
  ToastId,
  LightMode,
  Avatar
} from "@chakra-ui/react";
import MenuLink from "./MenuLink";
import useUser from "../lib/useUser";
import {
  FaClipboardCheck,
  FaClipboardList,
  FaCube,
  FaFileAlt,
  FaFileInvoice,
  FaHashtag,
  FaImages,
  FaLayerGroup,
  FaLightbulb,
  FaMoon,
  FaProjectDiagram,
  FaChartArea,
  FaChartBar,
  FaBroadcastTower,
  FaShoppingBag,
  FaSun,
  FaTape,
  FaUsers,
  FaBorderAll
} from "react-icons/fa";
import { BiChevronDown } from "react-icons/bi";
import { GiMechanicalArm, GiBlacksmith } from "react-icons/gi";
import type { IconType } from "react-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forwardRef, useRef } from "react";
import type { SVGProps } from "react";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { logOut } from "../api";
import LoginModal from "./LoginModal";
import SignUpModal from "./SignUpModal";
import LanguageSwitcher from "./LanguageSwitcher";

/** Remix RiBarChartHorizontalFill과 같은 가로 막대 3개(길이 상이); 가운데 막대만 진하게 */
const EpRealtimeBarNavIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function EpRealtimeBarNavIcon(props, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        {...props}
      >
        <rect
          x="3"
          y="3"
          width="9"
          height="4"
          fill="currentColor"
          opacity={0.4}
        />
        <rect x="3" y="10" width="19" height="4" fill="currentColor" />
        <rect
          x="3"
          y="17"
          width="13"
          height="4"
          fill="currentColor"
          opacity={0.4}
        />
      </svg>
    );
  }
);

type NavDef = { labelKey: string; path: string; icon: IconType };

/** BD 공장 — EP 생산 관련 메뉴 */
const BD_FACTORY_NAV_LINKS: NavDef[] = [
  {
    labelKey: "navbar.epProduction",
    path: "/ep-production",
    icon: EpRealtimeBarNavIcon as IconType
  },
  {
    labelKey: "navbar.epProductionOutputRecord",
    path: "/ep-production/daily-outputs",
    icon: FaClipboardList
  },
  {
    labelKey: "navbar.epDailyOutputReport",
    path: "/ep-production/daily-output-report",
    icon: FaChartBar
  },
  {
    labelKey: "navbar.epInspectionRecord",
    path: "/ep-production/inspections",
    icon: FaClipboardCheck
  },
  {
    labelKey: "navbar.epDailyInspectionReport",
    path: "/ep-production/daily-inspection-report",
    icon: FaChartArea
  },
  {
    labelKey: "navbar.hotColdPressIoTRecord",
    path: "/ep-production/iot-press-cycles",
    icon: GiMechanicalArm
  },
  {
    labelKey: "navbar.weldingRoom",
    path: "/welding-room",
    icon: GiBlacksmith
  }
];

/** VL 공장 — VL Assembly 관련 메뉴 */
const VL_FACTORY_NAV_LINKS: NavDef[] = [
  {
    labelKey: "navbar.vlAssemblyProduction",
    path: "/vl-assembly-production",
    icon: EpRealtimeBarNavIcon as IconType
  },
  {
    labelKey: "navbar.vlAssemblyScheduleList",
    path: "/vl-assembly-production/schedules",
    icon: FaProjectDiagram
  },
  {
    labelKey: "navbar.vlAssemblyScheduleProductionDailyOutput",
    path: "/vl-assembly-production/schedule-daily-outputs",
    icon: FaFileAlt
  },
  {
    labelKey: "navbar.vlAssemblyDailyOutput",
    path: "/vl-assembly-production/daily-outputs",
    icon: FaClipboardList
  },
  {
    labelKey: "navbar.vlAssemblyDailyProcessOutputReport",
    path: "/vl-assembly-production/daily-output-report",
    icon: FaChartBar
  },
  {
    labelKey: "navbar.vlAssemblyModuleOutputRecord",
    path: "/vl-assembly-production/module-daily-outputs",
    icon: FaClipboardList
  },
  {
    labelKey: "navbar.vlAssemblyModuleOutputReport",
    path: "/vl-assembly-production/module-daily-output-report",
    icon: FaChartBar
  },
  {
    labelKey: "navbar.vlAssemblyInspectionRecord",
    path: "/vl-assembly-production/inspections",
    icon: FaClipboardCheck
  },
  {
    labelKey: "navbar.vlAssemblyDailyInspectionReportNav",
    path: "/vl-assembly-production/daily-inspection-report",
    icon: FaChartArea
  },
  {
    labelKey: "navbar.vlFactoryLive",
    path: "/vl-factory-live",
    icon: FaBroadcastTower
  },
  {
    labelKey: "navbar.vlErpDashboard",
    path: "/vl-erp-dashboard",
    icon: FaChartBar
  }
];

/** Sample Room — 지그 관리, 납바 관리 등 */
const SAMPLE_ROOM_NAV_LINKS: NavDef[] = [
  { labelKey: "navbar.jigManagement", path: "/jigs", icon: FaLayerGroup },
  { labelKey: "navbar.bindingGuideManagement", path: "/binding-guides", icon: FaTape },
  { labelKey: "navbar.aluminumMoldManagement", path: "/aluminum-molds", icon: FaBorderAll }
];

/** TG 공장 — 전용 메뉴 */
const TG_FACTORY_NAV_LINKS: NavDef[] = [
  { labelKey: "navbar.tgBindingGuideManagement", path: "/tg-binding-guides", icon: FaTape },
  { labelKey: "navbar.tgJigManagement", path: "/tg-jigs", icon: FaLayerGroup },
];

/** 공통 — 마스터 데이터 등 */
const COMMON_NAV_LINKS: NavDef[] = [
  { labelKey: "navbar.sjStyles", path: "/sjstyles", icon: FaShoppingBag },
  { labelKey: "navbar.sjNo", path: "/sjnos", icon: FaHashtag },
  { labelKey: "navbar.sjOrders", path: "/sjorders", icon: FaFileInvoice },
  { labelKey: "navbar.sjWorkers", path: "/workers", icon: FaUsers },
  { labelKey: "navbar.sjMachines", path: "/machines", icon: GiMechanicalArm },
  {
    labelKey: "navbar.sjModules",
    path: "/production-process/modules",
    icon: FaCube
  },
  {
    labelKey: "navbar.sjProcesses",
    path: "/production-process/processes",
    icon: FaProjectDiagram
  },
  { labelKey: "navbar.kaizen", path: "/kaizen", icon: FaLightbulb }
];

type FactoryNavDropdownProps = {
  groupLabelKey: string;
  links: NavDef[];
  menuListBackgroundColor: string;
  boxShadowColor: string;
  onMenuItemClose: () => void;
};

function FactoryNavDropdown({
  groupLabelKey,
  links,
  menuListBackgroundColor,
  boxShadowColor,
  onMenuItemClose
}: FactoryNavDropdownProps) {
  const { t } = useTranslation();
  const btnColor = useColorModeValue("gray.700", "gray.200");
  return (
    <Menu autoSelect={false} isLazy>
      <MenuButton
        as={Button}
        variant="ghost"
        size="sm"
        fontWeight="semibold"
        color={btnColor}
        rightIcon={<BiChevronDown size={16} />}
      >
        {t(groupLabelKey)}
      </MenuButton>
      <MenuList
        bg={menuListBackgroundColor}
        border="none"
        boxShadow={boxShadowColor}
        zIndex={1500}
        minW="260px"
      >
        {links.map((link, index) => (
          <MenuLink
            key={`${link.path}-${index}`}
            name={t(link.labelKey)}
            path={link.path}
            icon={link.icon}
            onClose={onMenuItemClose}
          />
        ))}
      </MenuList>
    </Menu>
  );
}

type TgFactoryNavDropdownProps = {
  links: NavDef[];
  menuListBackgroundColor: string;
  boxShadowColor: string;
  onMenuItemClose: () => void;
};

function TgFactoryNavDropdown({
  links,
  menuListBackgroundColor,
  boxShadowColor,
  onMenuItemClose
}: TgFactoryNavDropdownProps) {
  const { t } = useTranslation();
  const btnColor = useColorModeValue("gray.700", "gray.200");
  return (
    <Menu autoSelect={false} isLazy>
      <MenuButton
        as={Button}
        variant="ghost"
        size="sm"
        fontWeight="semibold"
        color={btnColor}
        rightIcon={<BiChevronDown size={16} />}
      >
        {t("navbar.tgFactory")}
      </MenuButton>
      <MenuList
        bg={menuListBackgroundColor}
        border="none"
        boxShadow={boxShadowColor}
        zIndex={1500}
        minW="260px"
      >
        {links.map((link, index) => (
          <MenuLink
            key={`${link.path}-${index}`}
            name={t(link.labelKey)}
            path={link.path}
            icon={link.icon}
            onClose={onMenuItemClose}
          />
        ))}
      </MenuList>
    </Menu>
  );
}


export default function Navbar() {
  const { t } = useTranslation();
  // 모바일 햄버거 메뉴 (Menu 컴포넌트로 플로팅 팝업 제어)
  const { isOpen, onOpen, onClose } = useDisclosure();
  // Call useColorModeValue at the top level of the component
  const backgroundColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  // Community 드랍다운 메뉴 배경색
  const menuListBackgroundColor = useColorModeValue(
    "rgb(255, 255, 255)",
    "rgb(26, 32, 44)"
  );
  // Community 드랍다운 메뉴 박스 쉐도우
  const boxShadowColor = useColorModeValue(
    "2px 4px 6px 2px rgba(160, 174, 192, 0.6)",
    "2px 4px 6px 2px rgba(9, 17, 28, 0.6)"
  );

  // 로그인 여부에 따라서 로그인 버튼과 아바타가 나타나도록 현재 로그인한 user 가져오기
  const { userLoading, isLoggedIn, user } = useUser();
  const isWorker = user?.role === "worker";
  const isBdOnly = user?.factory_access === "BD";
  const isDevOnly = user?.factory_access === "DEVELOPMENT";
  const isTgOnly = user?.factory_access === "TG";

  // 로그인 모달
  const {
    isOpen: isLoginOpen,
    onClose: onLoginClose,
    onOpen: onLoginOpen
  } = useDisclosure();

  // 회원가입 모달
  const {
    isOpen: isSignUpOpen,
    onClose: onSignUpClose,
    onOpen: onSignUpOpen
  } = useDisclosure();

  // 다크모드 토글
  const { toggleColorMode } = useColorMode();
  const Icon = useColorModeValue(FaMoon, FaSun);
  const toast = useToast();
  const queryClient = useQueryClient();
  const toastId = useRef<ToastId>();
  const navigate = useNavigate();

  // 로그아웃 mutation
  const mutation = useMutation({
    mutationFn: logOut,
    onMutate: () => {
      toastId.current = toast({
        title: t("navbar.toastLogoutLoading"),
        description: t("navbar.toastLogoutLoadingDesc"),
        status: "loading",
        position: "bottom-right"
      });
    },
    onSuccess: () => {
      if (toastId.current) {
        // setQueryData 사용: removeQueries는 즉시 refetch를 유발하여
        // 세션 미삭제 시 다시 로그인된 것처럼 보이는 문제 방지
        queryClient.setQueryData([`me`], null);
        toast.update(toastId.current, {
          status: "success",
          title: t("navbar.toastLogoutDone"),
          description: t("navbar.toastLogoutDoneDesc")
        });
        navigate("/");
      }
    }
  });
  // 로그아웃 버튼 클릭시
  const onLogOut = async () => {
    mutation.mutate();
  };

  // 아래 로그인 페이지에서 Navbar를 보여주지 않기 위해 현재 페이지 경로 가져오기
  const location = useLocation();

  // 로그인 페이지와 manager 선택창에서는 Navbar를 보여주지 않음
  // 로그인 페이지와 manager 선택창에서는 Navbar를 보여주지 않음
  if (
    location.pathname === "/" ||
    location.pathname === "/users" ||
    location.pathname === "/terms/termsList" ||
    // 사진 업로드 페이지에서는 Navbar를 보여주지 않음. :termId 로는 사진 업로드 페이지를 구분할 수 없기 때문에 /photo로 끝나는 경로에서는 Navbar를 보여주지 않음
    (location.pathname.startsWith("/terms/upload/") &&
      location.pathname.endsWith("/photo"))
  ) {
    return null;
  }

  return (
    <Box
      py={"5"}
      px={{
        base: "5",
        md: "10"
      }}
      borderBottomWidth={"1"}
      borderColor={borderColor}
      bg={backgroundColor}
      position="relative"
      zIndex={1000}
    >
      <Flex
        h={16}
        alignItems="center"
        justifyContent={"space-between"}
        mx="auto"
      >
        {/* 왼쪽 로고, 페이지 링크, 드랍다운 메뉴 */}
        <Box
          display={"flex"}
          justifyContent={"flex-start"}
          alignItems="center"
          gap={2}
        >
          {/* Desktop: 로고를 클릭하면 홈으로 */}
          <Link
            as={RouterLink}
            to={isWorker ? "/worker/me" : "/home"}
            textDecoration="none"
            _hover={{ textDecoration: "none" }}
            display={{ base: "none", md: "flex" }}
          >
            <Box mr="5" gap="5" display="flex" alignItems="center">
              <img
                src="/sungjin_logo.png"
                alt={t("navbar.brandLogoAlt")}
                style={{ height: "34px", width: "auto", objectFit: "contain" }}
              />
              <Box>
                <Text
                  fontWeight="semibold"
                  color="gray.500"
                  _hover={{ textDecoration: "none" }}
                  lineHeight={1.2}
                >
                  VL Factory
                </Text>
                <Badge
                  colorScheme="purple"
                  fontSize="9px"
                  px={1.5}
                  borderRadius="sm"
                  mt="1px"
                >
                  Beta
                </Badge>
              </Box>
            </Box>
          </Link>
          {/* Mobile: 성진로고를 클릭하면 메뉴 열림 */}
          <Menu
            isOpen={isOpen}
            onClose={onClose}
            onOpen={onOpen}
            placement="bottom-start"
            autoSelect={false}
            isLazy
          >
            <MenuButton
              as={Box}
              display={{ base: "flex", md: "none" }}
              alignItems="center"
              cursor="pointer"
              flexShrink={0}
              aria-label={t("navbar.ariaOpenMenu")}
            >
              <img
                src="/sungjin_logo.png"
                alt={t("navbar.brandLogoAlt")}
                style={{
                  height: "34px",
                  width: "auto",
                  minWidth: "80px",
                  objectFit: "contain"
                }}
              />
            </MenuButton>
            <MenuList
              minW="240px"
              py={2}
              bg={menuListBackgroundColor}
              border="none"
              boxShadow={boxShadowColor}
              zIndex={1500}
              display={{ base: "block", md: "none" }}
            >
              {isWorker || isBdOnly ? (
                <MenuGroup title={t("navbar.bdFactory")}>
                  {BD_FACTORY_NAV_LINKS.map((link, index) => (
                    <MenuLink
                      key={`${link.path}-${index}`}
                      name={t(link.labelKey)}
                      path={link.path}
                      icon={link.icon}
                      onClose={onClose}
                    />
                  ))}
                </MenuGroup>
              ) : isDevOnly ? (
                <MenuGroup title={t("navbar.sampleRoom")}>
                  {SAMPLE_ROOM_NAV_LINKS.map((link, index) => (
                    <MenuLink
                      key={`${link.path}-${index}`}
                      name={t(link.labelKey)}
                      path={link.path}
                      icon={link.icon}
                      onClose={onClose}
                    />
                  ))}
                </MenuGroup>
              ) : isTgOnly ? (
                <MenuGroup title={t("navbar.tgFactory")}>
                  {TG_FACTORY_NAV_LINKS.map((link, index) => (
                    <MenuLink
                      key={`${link.path}-${index}`}
                      name={t(link.labelKey)}
                      path={link.path}
                      icon={link.icon}
                      onClose={onClose}
                    />
                  ))}
                </MenuGroup>
              ) : (
                <>
                  <MenuGroup title={t("navbar.vlFactory")}>
                    {VL_FACTORY_NAV_LINKS.map((link, index) => (
                      <MenuLink
                        key={`${link.path}-${index}`}
                        name={t(link.labelKey)}
                        path={link.path}
                        icon={link.icon}
                        onClose={onClose}
                      />
                    ))}
                  </MenuGroup>
                  <MenuDivider />
                  <MenuGroup title={t("navbar.tgFactory")}>
                    {TG_FACTORY_NAV_LINKS.map((link, index) => (
                      <MenuLink
                        key={`${link.path}-${index}`}
                        name={t(link.labelKey)}
                        path={link.path}
                        icon={link.icon}
                        onClose={onClose}
                      />
                    ))}
                  </MenuGroup>
                  <MenuDivider />
                  <MenuGroup title={t("navbar.bdFactory")}>
                    {BD_FACTORY_NAV_LINKS.map((link, index) => (
                      <MenuLink
                        key={`${link.path}-${index}`}
                        name={t(link.labelKey)}
                        path={link.path}
                        icon={link.icon}
                        onClose={onClose}
                      />
                    ))}
                  </MenuGroup>
                  <MenuDivider />
                  <MenuGroup title={t("navbar.sampleRoom")}>
                    {SAMPLE_ROOM_NAV_LINKS.map((link, index) => (
                      <MenuLink
                        key={`${link.path}-${index}`}
                        name={t(link.labelKey)}
                        path={link.path}
                        icon={link.icon}
                        onClose={onClose}
                      />
                    ))}
                  </MenuGroup>
                  <MenuDivider />
                  <MenuGroup title={t("navbar.commonMenu")}>
                    {COMMON_NAV_LINKS.map((link, index) => (
                      <MenuLink
                        key={`${link.path}-${index}`}
                        name={t(link.labelKey)}
                        path={link.path}
                        icon={link.icon}
                        onClose={onClose}
                      />
                    ))}
                  </MenuGroup>
                </>
              )}
            </MenuList>
          </Menu>
          {/* Desktop Screen 페이지 Links */}
          <HStack spacing={8} alignItems="center">
            <HStack
              as="nav"
              spacing={2}
              display={{ base: "none", md: "flex" }}
              alignItems="center"
              flexWrap="wrap"
            >
              {isWorker || isBdOnly ? (
                <FactoryNavDropdown
                  groupLabelKey="navbar.bdFactory"
                  links={BD_FACTORY_NAV_LINKS}
                  menuListBackgroundColor={menuListBackgroundColor}
                  boxShadowColor={boxShadowColor}
                  onMenuItemClose={() => {}}
                />
              ) : isDevOnly ? (
                <FactoryNavDropdown
                  groupLabelKey="navbar.sampleRoom"
                  links={SAMPLE_ROOM_NAV_LINKS}
                  menuListBackgroundColor={menuListBackgroundColor}
                  boxShadowColor={boxShadowColor}
                  onMenuItemClose={() => {}}
                />
              ) : isTgOnly ? (
                <TgFactoryNavDropdown
                  links={TG_FACTORY_NAV_LINKS}
                  menuListBackgroundColor={menuListBackgroundColor}
                  boxShadowColor={boxShadowColor}
                  onMenuItemClose={() => {}}
                />
              ) : (
                <>
                  <FactoryNavDropdown
                    groupLabelKey="navbar.vlFactory"
                    links={VL_FACTORY_NAV_LINKS}
                    menuListBackgroundColor={menuListBackgroundColor}
                    boxShadowColor={boxShadowColor}
                    onMenuItemClose={() => {}}
                  />
                  <TgFactoryNavDropdown
                    links={TG_FACTORY_NAV_LINKS}
                    menuListBackgroundColor={menuListBackgroundColor}
                    boxShadowColor={boxShadowColor}
                    onMenuItemClose={() => {}}
                  />
                  <FactoryNavDropdown
                    groupLabelKey="navbar.bdFactory"
                    links={BD_FACTORY_NAV_LINKS}
                    menuListBackgroundColor={menuListBackgroundColor}
                    boxShadowColor={boxShadowColor}
                    onMenuItemClose={() => {}}
                  />
                  <FactoryNavDropdown
                    groupLabelKey="navbar.sampleRoom"
                    links={SAMPLE_ROOM_NAV_LINKS}
                    menuListBackgroundColor={menuListBackgroundColor}
                    boxShadowColor={boxShadowColor}
                    onMenuItemClose={() => {}}
                  />
                  <FactoryNavDropdown
                    groupLabelKey="navbar.commonMenu"
                    links={COMMON_NAV_LINKS}
                    menuListBackgroundColor={menuListBackgroundColor}
                    boxShadowColor={boxShadowColor}
                    onMenuItemClose={() => {}}
                  />
                </>
              )}
            </HStack>
          </HStack>
        </Box>
        {/* 오른쪽 언어변경, 로그인 버튼, 아바타 */}
        <Box>
          <HStack
            spacing={{
              base: "0.5",
              md: "1.5"
            }}
          >
            {/* Photos & Videos — Worker / DEVELOPMENT / TG 계정은 숨김 */}
            {!isWorker && !isDevOnly && !isTgOnly ? (
              <Link
                as={RouterLink}
                to="/media"
                _hover={{ textDecoration: "none" }}
              >
                <IconButton
                  aria-label={t("navbar.ariaPhotosVideos")}
                  icon={<FaImages size={18} />}
                  size="sm"
                  variant="ghost"
                />
              </Link>
            ) : null}
            {/* 다크 모드 토글 */}
            <IconButton
              onClick={toggleColorMode}
              variant={"ghost"}
              aria-label={t("navbar.ariaDarkMode")}
              icon={<Icon />}
            ></IconButton>
            {/* // 언어 변경 버튼 */}
            <LanguageSwitcher />

            {/* user 로딩이 안되면 null 페이지로 */}
            {!userLoading ? (
              // 로그인 안되면 버튼이 나타나고 로그인시에만 아바타가 나타나도록
              !isLoggedIn ? (
                <>
                  <Button onClick={onLoginOpen}>{t("navbar.logIn")}</Button>
                  <LightMode>
                    {/* <Button onClick={onSignUpOpen} colorScheme={"red"}>
                      Sign up
                    </Button> */}
                  </LightMode>
                </>
              ) : (
                <Menu>
                  {/* 로그인 user 아바타 드랍다운 버튼 */}
                  <MenuButton>
                    <Avatar name={user?.name} src={user?.avatar} size={"sm"} />
                  </MenuButton>
                  {/* 로그인 후 아바타 클릭시 드랍다운 사용자 페이지 */}
                  <MenuList>
                    {isWorker ? (
                      <>
                        <MenuItem
                          as={RouterLink}
                          to="/worker/me"
                          textDecoration="none"
                        >
                          {t("navbar.myProfile")}
                        </MenuItem>
                        <MenuItem onClick={onLogOut}>
                          {t("navbar.logOut")}
                        </MenuItem>
                      </>
                    ) : (
                      <>
                        <MenuItem
                          as={RouterLink}
                          to="/users/me"
                          textDecoration="none"
                        >
                          {t("navbar.myProfile")}
                        </MenuItem>
                        <MenuItem onClick={onLogOut}>
                          {t("navbar.logOut")}
                        </MenuItem>
                      </>
                    )}
                  </MenuList>
                </Menu>
              )
            ) : null}
          </HStack>
          {/* 로그인 모달 */}
          <LoginModal isOpen={isLoginOpen} onClose={onLoginClose} />
          {/* 회원가입 모달 */}
          <SignUpModal isOpen={isSignUpOpen} onClose={onSignUpClose} />
        </Box>
      </Flex>
    </Box>
  );
}
