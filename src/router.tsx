import { createBrowserRouter, Navigate } from "react-router-dom";
import Root from "./components/Root";
import BookingDetail from "./routes/BookingDetail";
import BookingEdit from "./routes/BookingEdit";
import GithubConfirm from "./routes/GithubConfirm";
import Home from "./routes/Home";
import KakaoConfirm from "./routes/KakaoConfirm";
import NotFound from "./routes/NotFound";
import RoomDetail from "./routes/RoomDetail";
import RoomEdit from "./routes/RoomEdit";
import UploadPhotos from "./routes/UploadPhotos";
import UploadRoom from "./routes/UploadRoom";
import MyProfile from "./routes/MyProfile";
import EditMyProfile from "./routes/EditMyProfile";
import UserProfile from "./routes/UserProfile";
import MyBooking from "./routes/MyBooking";
import WishList from "./routes/WishList";
import LoginPage from "./routes/LoginPage";
import useUser from "./lib/useUser";
import FindUser from "./routes/FindUser";
import UploadVideos from "./routes/UploadVideos";
import ProtectedPage from "./components/ProtectPage";
import BagTermDetail from "./routes/BagTermDetail";
import BagTerms from "./routes/BagTerms";
import UploadBagTerm from "./routes/UploadBagTerm";
import FindTerm from "./routes/FindTerms/FindTerm";
import FindSynonym1 from "./routes/FindTerms/FindSynonym1";
import FindSynonym2 from "./routes/FindTerms/FindSynonym2";
import FindSynonym3 from "./routes/FindTerms/FindSynonym3";
import FindSynonym4 from "./routes/FindTerms/FindSynonym4";
import FindSynonym10 from "./routes/FindTerms/FindSynonym10";
import FindSynonym9 from "./routes/FindTerms/FindSynonym9";
import FindSynonym8 from "./routes/FindTerms/FindSynonym8";
import FindSynonym7 from "./routes/FindTerms/FindSynonym7";
import FindSynonym6 from "./routes/FindTerms/FindSynonym6";
import FindSynonym5 from "./routes/FindTerms/FindSynonym5";
import BagTermEdit from "./routes/BagTermEdit";
import UploadTermPhoto from "./routes/UploadTermPhoto";
import AboutUs from "./routes/AboutUs";
import AboutMe from "./routes/AboutMe";
import TranslateTerms from "./routes/TranslateTerms";
import BlogList from "./routes/BlogList";
import BlogDetail from "./routes/BlogDetail";
import UploadBlog from "./routes/UploadBlog";
import BlogEdit from "./routes/BlogEdit";
import UploadPostPhoto from "./components/UploadPostPhoto";
import ToolList from "./routes/ToolList";
import ToolDetail from "./routes/ToolDetail";
import JigList from "./routes/JigList";
import JigCreate from "./routes/JigCreate";
import JigDetail from "./routes/JigDetail";
import JigLocationList from "./routes/JigLocationList";
import JigLocationDetail from "./routes/JigLocationDetail";
import BindingGuideList from "./routes/BindingGuideList";
import BindingGuideCreate from "./routes/BindingGuideCreate";
import BindingGuideDetail from "./routes/BindingGuideDetail";
import BindingGuideLocationList from "./routes/BindingGuideLocationList";
import BindingGuideLocationDetail from "./routes/BindingGuideLocationDetail";
import JigPublicDetail from "./routes/JigPublicDetail";
import BindingGuidePublicDetail from "./routes/BindingGuidePublicDetail";
import AluminumMoldList from "./routes/AluminumMoldList";
import AluminumMoldCreate from "./routes/AluminumMoldCreate";
import AluminumMoldDetail from "./routes/AluminumMoldDetail";
import AluminumMoldLocationList from "./routes/AluminumMoldLocationList";
import AluminumMoldLocationDetail from "./routes/AluminumMoldLocationDetail";
import AluminumMoldPublicDetail from "./routes/AluminumMoldPublicDetail";
import TgBindingGuideList from "./routes/TgBindingGuideList";
import TgBindingGuideCreate from "./routes/TgBindingGuideCreate";
import TgBindingGuideDetail from "./routes/TgBindingGuideDetail";
import TgBindingGuideLocationList from "./routes/TgBindingGuideLocationList";
import TgBindingGuideLocationDetail from "./routes/TgBindingGuideLocationDetail";
import TgBindingGuidePublicDetail from "./routes/TgBindingGuidePublicDetail";
import TgJigList from "./routes/TgJigList";
import TgJigCreate from "./routes/TgJigCreate";
import TgJigDetail from "./routes/TgJigDetail";
import TgJigLocationList from "./routes/TgJigLocationList";
import TgJigLocationDetail from "./routes/TgJigLocationDetail";
import TgJigPublicDetail from "./routes/TgJigPublicDetail";
import MediaList from "./routes/MediaList";
import MediaDetail from "./routes/MediaDetail";
import SjStyleList from "./routes/SjStyleList";
import SjStyleDetail from "./routes/SjStyleDetail";
import SjNoList from "./routes/SjNoList";
import SjNoDetail from "./routes/SjNoDetail";
import SjOrderList from "./routes/SjOrderList";
import SjOrderDetail from "./routes/SjOrderDetail";
import SjWorkerList from "./routes/SjWorkerList";
import SjWorkerDetail from "./routes/SjWorkerDetail";
import WorkerMe from "./routes/WorkerMe";
import SjModuleList from "./routes/SjModuleList";
import SjModuleDetail from "./routes/SjModuleDetail";
import ModuleCategorySettings from "./routes/ModuleCategorySettings";
import SjProcessList from "./routes/SjProcessList";
import SjProcessDetail from "./routes/SjProcessDetail";
import SjMachineList from "./routes/SjMachineList";
import SjMachineDetail from "./routes/SjMachineDetail";
import EpScheduleList from "./routes/EpScheduleList";
import EpScheduleDetail from "./routes/EpScheduleDetail";
import EpSjNoDetail from "./routes/EpSjNoDetail";
import EpModuleDetail from "./routes/EpModuleDetail";
import EpProcessDetail from "./routes/EpProcessDetail";
import EpProcessWorkOrderPrint from "./routes/EpProcessWorkOrderPrint";
import EpDashboard from "./routes/EpDashboard";
import EpProductionDailyOutputList from "./routes/EpProductionDailyOutputList";
import EpProductionDailyOutputDetail from "./routes/EpProductionDailyOutputDetail";
import EpInspectionList from "./routes/EpInspectionList";
import EpInspectionForm from "./routes/EpInspectionForm";
import EpInspectionDetail from "./routes/EpInspectionDetail";
import EpInspectionDefectCategorySettings from "./routes/EpInspectionDefectCategorySettings";
import EpDailyOutputReport from "./routes/EpDailyOutputReport";
import EpDailyInspectionReport from "./routes/EpDailyInspectionReport";
import VlAssemblyScheduleList from "./routes/VlAssemblyScheduleList";
import VlAssemblyScheduleManagementList from "./routes/VlAssemblyScheduleManagementList";
import VlAssemblyScheduleDetail from "./routes/VlAssemblyScheduleDetail";
import VlAssemblySjNoDetail from "./routes/VlAssemblySjNoDetail";
import VlAssemblySjNoScheduleProductionDailyOutputList from "./routes/VlAssemblySjNoScheduleProductionDailyOutputList";
import VlAssemblyModuleDetail from "./routes/VlAssemblyModuleDetail";
import VlAssemblyProcessDetail from "./routes/VlAssemblyProcessDetail";
import VlAssemblyProcessWorkOrderPrint from "./routes/VlAssemblyProcessWorkOrderPrint";
import VlAssemblyProductionDailyOutputList from "./routes/VlAssemblyProductionDailyOutputList";
import VlAssemblyProductionDailyOutputDetail from "./routes/VlAssemblyProductionDailyOutputDetail";
import VlAssemblyDailyOutputReport from "./routes/VlAssemblyDailyOutputReport";
import VlAssemblyModuleProductionDailyOutputList from "./routes/VlAssemblyModuleProductionDailyOutputList";
import VlAssemblyModuleProductionDailyOutputDetail from "./routes/VlAssemblyModuleProductionDailyOutputDetail";
import VlAssemblyModuleDailyOutputReport from "./routes/VlAssemblyModuleDailyOutputReport";
import VlAssemblyInspectionList from "./routes/VlAssemblyInspectionList";
import VlAssemblyInspectionForm from "./routes/VlAssemblyInspectionForm";
import VlAssemblyInspectionDetail from "./routes/VlAssemblyInspectionDetail";
import VlAssemblyDailyInspectionReport from "./routes/VlAssemblyDailyInspectionReport";
import VlAssemblyScheduleProductionDailyOutputList from "./routes/VlAssemblyScheduleProductionDailyOutputList";
import VlAssemblyScheduleProductionDailyOutputDetail from "./routes/VlAssemblyScheduleProductionDailyOutputDetail";
import SjKaizenList from "./routes/SjKaizenList";
import SjKaizenDetail from "./routes/SjKaizenDetail";
import SjKaizenEditor from "./routes/SjKaizenEditor";
import HotColdPressIoTList from "./routes/HotColdPressIoTList";
import HotColdPressIoTCycleDetail from "./routes/HotColdPressIoTCycleDetail";
import WeldingRoom from "./routes/WeldingRoom";
import IotSetupMobile from "./routes/IotSetupMobile";
import VlFactoryLive from "./routes/VlFactoryLive";
import VlErpDashboard from "./routes/VlErpDashboard";
const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <NotFound />,
    children: [
      {
        path: "",
        element: <LoginPage />
      },
      {
        path: "home",
        element: <EpDashboard />
      },
      {
        path: "tools",
        children: [
          {
            path: "",
            element: <ToolList />
          },
          {
            path: ":toolId",
            element: <ToolDetail />
          }
        ]
      },
      {
        path: "jigs",
        children: [
          {
            path: "",
            element: <JigList />
          },
          {
            path: "upload",
            element: <JigCreate />
          },
          {
            path: "locations",
            element: <JigLocationList />
          },
          {
            path: "locations/:locationId",
            element: <JigLocationDetail />
          },
          {
            path: ":jigId",
            element: <JigDetail />
          }
        ]
      },
      {
        path: "binding-guides",
        children: [
          {
            path: "",
            element: <BindingGuideList />
          },
          {
            path: "upload",
            element: <BindingGuideCreate />
          },
          {
            path: "locations",
            element: <BindingGuideLocationList />
          },
          {
            path: "locations/:locationId",
            element: <BindingGuideLocationDetail />
          },
          {
            path: ":bindingGuideId",
            element: <BindingGuideDetail />
          }
        ]
      },
      {
        path: "tg-binding-guides",
        children: [
          {
            path: "",
            element: <TgBindingGuideList />
          },
          {
            path: "upload",
            element: <TgBindingGuideCreate />
          },
          {
            path: "locations",
            element: <TgBindingGuideLocationList />
          },
          {
            path: "locations/:locationId",
            element: <TgBindingGuideLocationDetail />
          },
          {
            path: ":tgBindingGuideId",
            element: <TgBindingGuideDetail />
          }
        ]
      },
      {
        path: "tg-jigs",
        children: [
          {
            path: "",
            element: <TgJigList />
          },
          {
            path: "upload",
            element: <TgJigCreate />
          },
          {
            path: "locations",
            element: <TgJigLocationList />
          },
          {
            path: "locations/:locationId",
            element: <TgJigLocationDetail />
          },
          {
            path: ":tgJigId",
            element: <TgJigDetail />
          }
        ]
      },
      {
        path: "aluminum-molds",
        children: [
          {
            path: "",
            element: <AluminumMoldList />
          },
          {
            path: "upload",
            element: <AluminumMoldCreate />
          },
          {
            path: "locations",
            element: <AluminumMoldLocationList />
          },
          {
            path: "locations/:locationId",
            element: <AluminumMoldLocationDetail />
          },
          {
            path: ":aluminumMoldId",
            element: <AluminumMoldDetail />
          }
        ]
      },
      {
        path: "terms",
        children: [
          {
            path: "",
            element: <BagTerms />
          },
          {
            path: ":termId",
            element: <BagTermDetail />
          },
          {
            path: ":termId/edit",
            element: <BagTermEdit />
          },
          {
            path: "upload",
            children: [
              {
                path: "",
                element: <UploadBagTerm />
              },
              { path: ":termId/photo", element: <UploadTermPhoto /> }
            ]
          },
          {
            path: "termsList",
            children: [
              {
                path: "",
                element: <FindTerm />
              },
              {
                path: "synonym1",
                element: <FindSynonym1 />
              },
              {
                path: "synonym2",
                element: <FindSynonym2 />
              },
              {
                path: "synonym3",
                element: <FindSynonym3 />
              },
              {
                path: "synonym4",
                element: <FindSynonym4 />
              },
              {
                path: "synonym5",
                element: <FindSynonym5 />
              },
              {
                path: "synonym6",
                element: <FindSynonym6 />
              },
              {
                path: "synonym7",
                element: <FindSynonym7 />
              },
              {
                path: "synonym8",
                element: <FindSynonym8 />
              },
              {
                path: "synonym9",
                element: <FindSynonym9 />
              },
              {
                path: "synonym10",
                element: <FindSynonym10 />
              }
            ]
          }
        ]
      },
      {
        path: "aboutus",
        children: [
          {
            path: "",
            element: <AboutUs />
          },
          {
            path: "aboutme",
            element: <AboutMe />
          }
        ]
      },
      {
        path: "users",
        children: [
          {
            path: "",
            element: <FindUser />
          },
          {
            path: "mybookings",
            element: <MyBooking />
          },
          {
            path: "wishlist",
            element: <WishList />
          },
          {
            path: "me",
            element: <MyProfile />
          },
          {
            path: "me/edit",
            element: <EditMyProfile />
          },
          {
            path: "login",
            element: <LoginPage />
          },
          {
            path: ":userId",
            element: <UserProfile />
          }
        ]
      },
      {
        path: "bookings",
        children: [
          {
            path: ":bookingId",
            element: <BookingDetail />
          },
          { path: ":bookingId/edit", element: <BookingEdit /> }
        ]
      },
      {
        path: "rooms",
        children: [
          {
            path: "upload",
            element: <UploadRoom />
          },
          {
            path: ":roomPk",
            element: <RoomDetail />
          },
          {
            path: ":roomPk/photos",
            element: <UploadPhotos />
          },
          {
            path: ":roomPk/videos",
            element: <UploadVideos />
          },
          {
            path: ":roomPk/edit",
            element: <RoomEdit />
          }
        ]
      },
      {
        path: "social",
        children: [
          {
            path: "github",
            element: <GithubConfirm />
          },
          {
            path: "kakao",
            element: <KakaoConfirm />
          }
        ]
      },
      {
        path: "translate",
        element: <TranslateTerms />
      },
      {
        path: "blog",
        children: [
          {
            path: "",
            element: <BlogList />
          },
          {
            path: ":blogId",
            element: <BlogDetail />
          },
          {
            path: ":blogId/edit",
            element: <BlogEdit />
          },

          {
            path: "upload",
            element: <UploadBlog />
          }
        ]
      },
      {
        path: "media",
        children: [
          {
            path: "",
            element: <MediaList />
          },
          {
            path: ":type/:pk",
            element: <MediaDetail />
          }
        ]
      },
      {
        path: "sjstyles",
        children: [
          {
            path: "",
            element: <SjStyleList />
          },
          {
            path: ":styleId",
            element: <SjStyleDetail />
          }
        ]
      },
      {
        path: "sjnos",
        children: [
          { path: "", element: <SjNoList /> },
          { path: ":sjNoId", element: <SjNoDetail /> }
        ]
      },
      {
        path: "sjorders",
        children: [
          { path: "", element: <SjOrderList /> },
          { path: ":orderId", element: <SjOrderDetail /> }
        ]
      },
      {
        path: "workers",
        children: [
          { path: "", element: <SjWorkerList /> },
          { path: ":workerId", element: <SjWorkerDetail /> }
        ]
      },
      {
        path: "worker",
        children: [{ path: "me", element: <WorkerMe /> }]
      },
      {
        path: "machines",
        children: [
          { path: "", element: <SjMachineList /> },
          { path: ":machineId", element: <SjMachineDetail /> }
        ]
      },
      {
        path: "production-process",
        children: [
          { path: "module-categories", element: <ModuleCategorySettings /> },
          { path: "modules", element: <SjModuleList /> },
          { path: "modules/:moduleId", element: <SjModuleDetail /> },
          { path: "processes", element: <SjProcessList /> },
          { path: "processes/:processId", element: <SjProcessDetail /> }
        ]
      },

      {
        path: "vl-assembly-production",
        children: [
          { path: "", element: <VlAssemblyScheduleList /> },
          { path: "schedules", element: <VlAssemblyScheduleManagementList /> },
          {
            path: "schedule-daily-outputs/new",
            element: (
              <Navigate
                to="/vl-assembly-production/schedule-daily-outputs?add=1"
                replace
              />
            )
          },
          {
            path: "schedule-daily-outputs",
            element: <VlAssemblyScheduleProductionDailyOutputList />
          },
          {
            path: "schedule-daily-outputs/:outputId",
            element: <VlAssemblyScheduleProductionDailyOutputDetail />
          },
          {
            path: "daily-outputs/new",
            element: (
              <Navigate
                to="/vl-assembly-production/daily-outputs?add=1"
                replace
              />
            )
          },
          { path: "daily-outputs", element: <VlAssemblyProductionDailyOutputList /> },
          {
            path: "daily-outputs/:outputId",
            element: <VlAssemblyProductionDailyOutputDetail />
          },
          {
            path: "daily-output-report",
            element: <VlAssemblyDailyOutputReport />
          },
          {
            path: "module-daily-outputs",
            element: <VlAssemblyModuleProductionDailyOutputList />
          },
          {
            path: "module-daily-outputs/:outputId",
            element: <VlAssemblyModuleProductionDailyOutputDetail />
          },
          {
            path: "module-daily-output-report",
            element: <VlAssemblyModuleDailyOutputReport />
          },
          { path: "inspections/new", element: <VlAssemblyInspectionForm /> },
          {
            path: "inspections/:inspectionId",
            element: <VlAssemblyInspectionDetail />
          },
          { path: "inspections", element: <VlAssemblyInspectionList /> },
          {
            path: "inspection-defect-categories",
            element: <EpInspectionDefectCategorySettings />
          },
          {
            path: "daily-inspection-report",
            element: <VlAssemblyDailyInspectionReport />
          },
          { path: ":scheduleId", element: <VlAssemblyScheduleDetail /> },
          {
            path: "sj-nos/:sjNoId/schedule-daily-outputs",
            element: <VlAssemblySjNoScheduleProductionDailyOutputList />
          },
          { path: "sj-nos/:sjNoId", element: <VlAssemblySjNoDetail /> },
          { path: "modules/:moduleId", element: <VlAssemblyModuleDetail /> },
          {
            path: "processes/:processId/work-order",
            element: <VlAssemblyProcessWorkOrderPrint />
          },
          { path: "processes/:processId", element: <VlAssemblyProcessDetail /> }
        ]
      },
      {
        path: "kaizen",
        children: [
          { path: "", element: <SjKaizenList /> },
          { path: "new", element: <SjKaizenEditor /> },
          { path: ":kaizenId", element: <SjKaizenDetail /> },
          { path: ":kaizenId/edit", element: <SjKaizenEditor /> }
        ]
      },
      {
        path: "ep-production",
        children: [
          { path: "", element: <EpScheduleList /> },
          { path: "daily-outputs", element: <EpProductionDailyOutputList /> },
          {
            path: "daily-outputs/:outputId",
            element: <EpProductionDailyOutputDetail />
          },
          { path: "inspections/new", element: <EpInspectionForm /> },
          {
            path: "inspections/:inspectionId",
            element: <EpInspectionDetail />
          },
          { path: "inspections", element: <EpInspectionList /> },
          {
            path: "inspection-defect-categories",
            element: <EpInspectionDefectCategorySettings />
          },
          {
            path: "daily-output-report",
            element: <EpDailyOutputReport />
          },
          {
            path: "daily-inspection-report",
            element: <EpDailyInspectionReport />
          },
          { path: ":scheduleId", element: <EpScheduleDetail /> },
          { path: "sj-nos/:sjNoId", element: <EpSjNoDetail /> },
          { path: "modules/:moduleId", element: <EpModuleDetail /> },
          {
            path: "processes/:processId/work-order",
            element: <EpProcessWorkOrderPrint />
          },
          { path: "processes/:processId", element: <EpProcessDetail /> },
          {
            path: "iot-press-cycles",
            element: <HotColdPressIoTList />,
          },
          {
            path: "iot-press-cycles/:cycleId",
            element: <HotColdPressIoTCycleDetail />,
          }
        ]
      },
      {
        path: "welding-room",
        element: <WeldingRoom />
      },
      {
        path: "vl-factory-live",
        element: <VlFactoryLive />
      },
      {
        path: "vl-erp-dashboard",
        element: <VlErpDashboard />
      }
    ]
  },
  // ── 공개 페이지 (로그인 불필요 — QR 스캔용) ──────────────────────────
  {
    path: "/public/jigs/:jigId",
    element: <JigPublicDetail />,
  },
  {
    path: "/public/binding-guides/:bindingGuideId",
    element: <BindingGuidePublicDetail />,
  },
  {
    path: "/public/tg-binding-guides/:tgBindingGuideId",
    element: <TgBindingGuidePublicDetail />,
  },
  {
    path: "/public/tg-jigs/:tgJigId",
    element: <TgJigPublicDetail />,
  },
  {
    path: "/public/aluminum-molds/:aluminumMoldId",
    element: <AluminumMoldPublicDetail />,
  },
  {
    path: "/public/iot-setup/:processPk",
    element: <IotSetupMobile />,
  },
]);

export default router;
