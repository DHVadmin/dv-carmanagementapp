# TestSprite 테스트 준비 자료 (Donghaeng Village App)

TestSprite를 통해 앱을 디버깅하고 테스트하기 위한 프로젝트 정보 및 테스트 시나리오입니다.

## 1. 프로젝트 개요
*   **프로젝트명**: 동행빌리지 차량관리 앱
*   **기술 스택**: React (Vite), TypeScript, Tailwind CSS, Firebase (Auth, Firestore)
*   **주요 목적**: 모바일 환경에서 차량 운행일지 작성 및 비상 정보 확인

## 2. 주요 테스트 대상 파일 (Core Files)
TestSprite가 분석해야 할 핵심 코드 파일들입니다.

*   **인증 및 라우팅**
    *   `src/App.tsx`: 전체 라우팅 및 보호된 라우트(Protected Route) 설정
    *   `src/context/AuthContext.tsx`: Firebase 인증 상태 관리
    *   `src/pages/LoginPage.tsx`: 구글 로그인 및 이메일 로그인 로직

*   **차량 대시보드**
    *   `src/pages/VehicleListPage.tsx`: 차량 목록 조회(Firestore), 데이터가 없을 때 시드 데이터 생성, 로그아웃

*   **운행일지 및 상세**
    *   `src/pages/DrivingLogPage.tsx`: **(가장 중요)**
        *   자동 주행거리 입력 로직 (`Fetch Last Mileage`)
        *   거리 계산 로직 (`end - start`)
        *   운행일지 저장 (Firestore Write)
        *   탭 전환 (운행일지 <-> 차량정보)

## 3. 핵심 테스트 시나리오 (Test Scenarios)

### A. 인증 (Authentication)
1.  로그인 페이지 진입 시 로그인되지 않은 상태여야 함.
2.  "Google 계정으로 로그인" 버튼 클릭 시 Firebase Popup이 호출되어야 함.
3.  로그인 성공 시 `/` (대시보드)로 리다이렉트.

### B. 대시보드 (Dashboard)
1.  차량 목록이 Firestore에서 정상적으로 로드되어야 함.
2.  데이터가 없을 경우 "테스트 데이터 생성" 버튼이 동작하여 Mock 데이터를 Firestore에 주입해야 함.
3.  차량 카드를 클릭하면 해당 차량의 `DrivingLogPage` (`/log/:id`)로 이동.

### C. 운행일지 작성 (Driving Log)
1.  페이지 진입 시, 해당 차량의 `lastMileage`가 Firestore에서 불러와져 `startMileage` (출발 거리) 필드에 **자동 입력**되어야 함.
2.  `endMileage` (도착 거리) 입력 시 `주행 거리`가 실시간으로 자동 계산되어야 함.
3.  유효성 검사: `도착 거리`가 `출발 거리`보다 작으면 경고창 등의 에러 처리.
4.  저장 버튼 클릭 시 `drivingLogs` 컬렉션에 데이터가 저장되고, `vehicles` 컬렉션의 `lastMileage`가 업데이트되어야 함.

### D. 비상 정보 (Vehicle Detail)
1.  상단 탭("차량/보험 정보") 클릭 시 화면 전환.
2.  보험사 전화번호 클릭 시 `tel:` 스키마가 작동해야 함.
3.  차량등록증 이미지가 렌더링되어야 함.

## 4. 환경 변수 (Environment)
테스트를 위해서는 로컬 환경 또는 TestSprite 환경에 아래 패키지들이 설치되어 있어야 합니다.
*   `firebase`
*   `react-router-dom`
*   `lucide-react`
*   `tailwindcss`

(*참고: 실제 Firebase 연동 테스트를 위해서는 `src/firebase.ts`에 유효한 Config 키가 있어야 합니다.*)
