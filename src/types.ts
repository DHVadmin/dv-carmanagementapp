export interface Vehicle {
    id: string;
    // --- 기본 정보 ---
    name: string; // 차명
    plateNumber: string; // 자동차등록번호
    initialRegistrationDate?: string; // 최초등록일
    initialMileage?: number; // 최초등록 누적거리 (v5 New)
    vehicleType?: string; // 차종
    usage?: string; // 용도
    imageUrl?: string | null; // 차량사진 URL
    ownerName?: string; // 소유자 명칭
    corporateRegNo?: string; // 법인등록번호
    ownerAddress?: string; // 주소
    baseAddress?: string; // 사용본거지
    registrationImage?: string | null; // 차량등록증 이미지 URL
    registrationImageName?: string | null; // 차량등록증 파일명

    // --- 제원 정보 ---
    format?: string; // 형식
    modelYear?: string; // 모델연도
    vin?: string; // 차대번호
    motorType?: string; // 원동기형식
    specMgmtNo?: string; // 제원관리번호
    length?: number; // 길이(mm)
    width?: number; // 너비(mm)
    height?: number; // 높이(mm)
    totalWeight?: number; // 총중량(kg)
    displacement?: number; // 배기량(cc)
    power?: string; // 정격출력
    capacity?: number; // 승차정원
    maxLoad?: number; // 최대적재량
    cylinders?: number; // 기통수
    fuelType: string; // 연료의종류 (Used for logic too)
    mpg?: number; // 연비

    lastMileage: number; // 앱 관리용

    // --- 보험 정보 ---
    insurance: InsuranceRecord; // Refactored to interface

    // --- 보험 이력 (v5 New) ---
    insuranceHistory?: InsuranceRecord[];

    consumables?: {
        [key: string]: {
            lastDate?: string;
            lastMileage?: number;
        }
    };
}

// v5 New: Separated Insurance Interface
export interface InsuranceRecord {
    company: string; // 보험사
    method?: string; // 가입방법
    manager?: string; // 담당자
    contact: string; // 연락처

    // v5 New Fields
    emergencyNumber?: string; // 긴급출동 번호
    emergencyDispatch?: number; // 긴급출동(회)
    emergencyFuel?: number; // 비상급유(회)
    towingDistance?: number; // 견인거리(KM)
    coverageType?: string; // 담보구분
    coverageAmount?: string; // 가입액
    propertyDamage?: string; // 대물배상(억)
    uninsuredInjury?: string; // 무보험차상해(억)
    ownDamageType?: string; // 자차기준(만원)
    otherClauses?: string; // 기타특약
    fileUrl?: string | null; // 증권 파일 URL
    fileName?: string | null; // 증권 파일명

    premium?: number; // 보험료
    startDate?: string; // 보험 시작일
    expiryDate: string; // 보험 만기일 (endDate)
    ageLimit?: string; // 연령한정(만)
    driverLimit?: string; // 운전자한정
    policyNumber?: string; // 계약번호 (policyNumber/contractNo)
    vehicleValue?: number; // 차량가액(만원)
    surchargeStandard?: string; // 할증기준

    specialClauses?: string[]; // 특약 1~9 (Legacy but kept)
    driverScope?: string; // Legacy support
    guaranteeDetails?: string; // Legacy support
}

// v5 New: System Settings
// v5 New: Notification Settings
export interface NotificationSettings {
    enabled: boolean;
    frequency?: 'daily' | 'weekly'; // Deprecated
    daysToSend: number[]; // 0=Sun, 1=Mon...
    sendHour: number; // 0-23
    messageTemplate: string;
    lastCheckedDate?: string; // YYYY-MM-DD

    insuranceAlertDays: number; // e.g. 30
    consumableAlertKm: number; // e.g. 500
    consumableAlertDays: number; // e.g. 30 (v5.1 New)

    messageTitle: string;
    messageFooter: string;
}

export interface ImageResizeConfig {
    maxWidth: number;
    maxHeight: number;
    quality: number;
}

export interface SystemSettings {
    id?: string; // 'default'
    drivingPurposes: string[]; // 운행 목적
    drivingDestinations: string[]; // 자주 가는 경유지/목적지
    maintenanceShops: string[]; // 자주 가는 정비소 (Old: frequentShops)
    gasStations: string[]; // 자주 가는 주유소
    paymentMethods?: string[]; // 결제 수단 / 자금 원천 (법인전입금, 자부담 등)
    consumableSettings: {
        label: string;
        distance: number;
        months: number;
    }[];
    imageResizeConfig?: ImageResizeConfig; // v5.1 New
    slackWebhook?: string; // 슬랙 알림 Webhook URL
    businessTripSlackWebhook?: string; // 관내출장 전용 알림 Webhook URL (v5.1 New)
    consumableSlackWebhook?: string; // 소모품 전용 알림 Webhook URL (v5.4 New)
    notificationSettings?: NotificationSettings; // v5 New
    sheetConfig?: {
        url: string;
    };
    businessTripConfig?: {
        url: string;
    };
    // v5.5 New: Integrated Notification & Slack Bot
    slackBotToken?: string; // Slack Bot User OAuth Token
    slackUsers?: {
        id: string;
        email: string;
        name: string;
        real_name?: string;
        display_name?: string;
    }[];
    integratedNotificationSettings?: IntegratedNotificationSettings;
}

export interface IntegratedNotificationSettings {
    enabled: boolean;
    messageTemplate: string;
    tripMessageTemplate?: string; // 관내출장용 템플릿
}

export interface DrivingLog {
    id?: string;
    vehicleId: string;
    vehicleName?: string; // Snapshot for history
    vehiclePlate?: string; // Snapshot for history
    date?: string; // Legacy support (Deprecated)
    startDate: string; // YYYY-MM-DD (New Standard)
    endDate: string; // YYYY-MM-DD (New Standard)
    startTime?: string;
    endTime?: string;
    userId: string;
    userName?: string;
    startMileage: number;
    endMileage: number;
    totalDistance: number;
    purpose: string; // "출퇴근" | "업무용" | "기타"
    detailPurpose?: string; // If purpose is "기타"
    startLocation?: string;
    endLocation?: string;
    destination?: string; // 목적지 (e.g., "병원 - 여천전남병원")
    passengerName?: string; // 동승자 성명
    passengerCount?: number; // 동승자 인원
    timestamp: any;
}

export interface MaintenanceLog {
    id?: string;
    vehicleId: string;
    vehicleName?: string;
    vehiclePlate?: string;
    userId: string;
    userName?: string;
    date?: string; // Legacy support (Deprecated)
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    item: string; // 정비항목 (일반, 사고, 정기)
    shop?: string; // 정비소
    cost: number;
    fundingSource?: string; // 자금원천 (보조금, 후원금, 자부담금, 법인전입금)
    timestamp: any;
    imageUrl?: string; // 정비 사진 URL
}

export interface FuelingLog {
    id?: string;
    vehicleId: string;
    vehicleName?: string;
    vehiclePlate?: string;
    userId: string;
    userName?: string;
    date?: string; // Legacy
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    amount: number;
    cost: number;
    pricePerLiter?: number; // 리터당 단가
    fundingSource?: string; // 자금원천
    station: string;
    timestamp: any;
    imageUrl?: string; // 주유 영수증/사진 URL
}

export interface ModificationRequest {
    id?: string;
    targetCollection: string;
    targetDocId: string;
    originalData: any;
    changeType: 'update' | 'delete';
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    requester: string;
    requesterName?: string;
    timestamp: any;
}

export type Log = (DrivingLog | FuelingLog | MaintenanceLog) & { type?: 'driving' | 'fueling' | 'maintenance'; typeKr?: string;[key: string]: any; };

// v5.7 New: Logbook Approval System
export interface LogbookApproval {
    id?: string;
    month: string; // YYYY-MM
    status: 'pending' | '담당' | '실장' | '국장' | 'approved' | 'rejected';
    currentStep: number; // 0, 1, 2, 3
    vehicleIds: string[]; // List of vehicle IDs included in this batch
    logsData: string; // JSON stringified minimal log data to preserve the snapshot
    approvals: {
        step: number;
        role: string;
        userId?: string;
        userName?: string;
        timestamp?: any;
    }[];
    rejectionReason?: string;
    createdAt: any;
    updatedAt: any;
}
