# NiceTop - Firebase 배포 가이드

## 사전 준비

1. **Firebase CLI 로그인**
   ```bash
   npx firebase login
   ```

2. **Firebase 프로젝트 확인**
   - 프로젝트 ID: `discord-nt`
   - `.firebaserc` 파일에 설정되어 있음

## 배포 명령어

### 전체 배포
```bash
npm run firebase:deploy
```
- Hosting (웹 앱)
- Functions (Cloud Functions)
- Firestore Rules
- Storage Rules

### 개별 배포

#### Cloud Functions만 배포
```bash
npm run firebase:deploy:functions
```

#### Hosting만 배포
```bash
npm run firebase:deploy:hosting
```

#### Security Rules만 배포
```bash
npm run firebase:deploy:rules
```

## 배포 전 체크리스트

- [x] Firebase 프로젝트 생성 (`discord-nt`)
- [x] 프로젝트 빌드 완료 (`build/` 디렉토리)
- [x] Firestore Security Rules 작성
- [x] Storage Security Rules 작성
- [x] Cloud Functions 코드 작성
- [ ] Firebase Authentication 설정 (Google 로그인 활성화)
- [ ] Firestore Database 생성
- [ ] Storage 버킷 생성

## Firebase Console 설정

### 1. Authentication 설정
1. Firebase Console → Authentication → Sign-in method
2. 이메일/비밀번호 활성화
3. Google 로그인 활성화

### 2. Firestore Database 생성
1. Firebase Console → Firestore Database
2. 데이터베이스 만들기
3. 프로덕션 모드로 시작 (Rules는 자동 배포됨)

### 3. Storage 설정
1. Firebase Console → Storage
2. 시작하기
3. 프로덕션 모드로 시작 (Rules는 자동 배포됨)

## 배포 후 확인사항

1. **Hosting URL 확인**
   ```bash
   npx firebase hosting:channel:list
   ```

2. **Functions 배포 확인**
   ```bash
   npx firebase functions:list
   ```

3. **보안 규칙 확인**
   - Firebase Console → Firestore Database → Rules
   - Firebase Console → Storage → Rules

## 로컬 테스트

### Firebase Emulators 실행
```bash
npm run firebase:emulators
```

이렇게 하면 로컬에서 Firebase 서비스를 테스트할 수 있습니다:
- Firestore
- Functions
- Hosting
- Storage

## 문제 해결

### 배포 실패 시
1. Firebase CLI 버전 확인
   ```bash
   npx firebase --version
   ```

2. 로그인 상태 확인
   ```bash
   npx firebase login:list
   ```

3. 프로젝트 재선택
   ```bash
   npx firebase use discord-nt
   ```

### Functions 배포 오류
1. Node.js 버전 확인 (18 이상 필요)
2. functions 폴더에서 dependencies 설치
   ```bash
   cd functions
   npm install
   ```

## 배포된 서비스 URL

- **Hosting**: `https://discord-nt.web.app`
- **Functions**: `https://us-central1-discord-nt.cloudfunctions.net`

## 주의사항

⚠️ **프로덕션 배포 전 확인**
- .env 파일의 API 키 보안
- Security Rules 검증
- Rate Limiting 설정 확인
- 파일 업로드 크기 제한 확인

## Cloud Functions

배포된 함수 목록:
- `createServer` - 서버 생성
- `createChannel` - 채널 생성
- `sendMessage` - 메시지 전송 (Rate Limiting 포함)
- `addServerMember` - 멤버 추가
- `updateUserPresence` - 사용자 상태 업데이트

## 비용 최적화

1. **Firestore 인덱스 최적화**
   - `firestore.indexes.json` 파일 확인
   - 불필요한 인덱스 제거

2. **Functions 실행 시간 최소화**
   - 타임아웃 설정
   - 메모리 제한 설정

3. **Storage 정책**
   - 오래된 파일 자동 삭제 규칙
   - 파일 크기 제한
