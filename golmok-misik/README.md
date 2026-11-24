# 골목미식

서울 25개 자치구와 경기 31개 시·군의 **미쉐린 가이드 · 블루리본 · 생활의 달인 · 백년가게** 식당을 한 지도에서 보는 모바일 웹앱입니다.
빌드 도구 없이 정적 파일로 동작하고, 데이터는 Node.js 스크립트로 매주 갱신합니다.

- 데스크톱: 왼쪽 목록 / 오른쪽 지도. 모바일: 검색·필터 → 지도 → 목록 세로 배치
- 서울·경기 / 시·군·구 선택, 상호·메뉴·동네·주소 검색, 가이드 필터 여러 개 선택(하나라도 해당하면 표시)
- 같은 지점이 여러 출처에 나오면 카드·핀 하나로 합치고 배지를 모두 표시
- 카드 ↔ 지도 핀 연동, 축소하면 가까운 핀은 숫자로 묶음 표시
- 상세: 상호, 메뉴, 주소, 가이드별 출처 링크, **네이버지도에서 보기**
- 좌표가 없는 곳은 핀 없이 목록에만 표시하고 네이버지도 검색으로 연결(위치를 추정해 찍지 않음)
- 즐겨찾기는 브라우저에 저장. 데이터 갱신으로 ID가 합쳐지거나 목록에서 빠져도 지워지지 않음
- `자료 현황` 버튼: 가이드별 실제 수록 건수, 자료 기준일, 아직 확보하지 못한 범위

## 바로 실행

```bash
cd golmok-misik
npm start            # http://localhost:8080
```

Node.js 20 이상이면 됩니다. 설치할 의존성은 없습니다(Leaflet은 `vendor/`에 포함).

## 네이버 지도 설정 (NAVER Maps JavaScript API v3)

Client ID가 없어도 기본 지도(OpenStreetMap)로 탐색할 수 있고, 각 식당은 `네이버지도에서 보기`로 열 수 있습니다.
앱 안의 지도를 네이버 지도로 바꾸려면:

1. [네이버 클라우드 플랫폼 콘솔](https://console.ncloud.com) → **Services → Application Services → Maps**
2. **Application 등록** → 사용할 API에서 **Dynamic Map** 선택
3. **서비스 환경 등록 → Web 서비스 URL**에 앱 주소를 넣습니다. 등록한 주소에서만 지도가 열립니다.
   - 로컬 확인: `http://localhost:8080`
   - GitHub Pages: `https://<계정>.github.io` (하위 경로는 적지 않아도 됩니다)
   - 직접 쓰는 도메인이 있으면 그 주소도 추가
4. 발급된 **Client ID**(지도 스크립트의 `ncpKeyId` 값)를 아래 중 한 곳에 넣습니다.
   - 직접 배포: `config.js`의 `naverMapsClientId`
   - GitHub Pages 배포: 저장소 **Settings → Secrets and variables → Actions → Variables**에 `NAVER_MAPS_CLIENT_ID` 추가(배포 때 `config.js`에 자동 주입)
   - 잠깐 시험만: 주소 뒤에 `?ncpKeyId=<Client ID>`

앱은 `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<Client ID>`를 불러옵니다.
인증이 실패하면(Client ID 오타, Web 서비스 URL 미등록) 자동으로 기본 지도로 바꾸고 화면 아래에 이유를 표시합니다.
Client ID는 브라우저에 노출되는 값이라 비밀이 아니며, 사용 도메인은 3번의 URL 등록으로 제한됩니다.

## 데이터

```
data/
  restaurants.json      앱이 읽는 최종 데이터(지점 단위로 병합된 식당)
  meta.json             가이드별 수록 건수·기준일·상태·미확보 범위(자료 현황 창)
  sources/*.json        출처별 원본 스냅숏(정규화된 레코드)
  address-aliases.json  같은 건물로 확인된 지번→도로명 주소 대응표
  update-report.json    마지막 갱신 결과(추가·주소 변경·목록 제외·검토 대상)
  imports/              공공데이터 CSV, 이용 권한이 있는 블루리본 데이터를 넣는 곳
```

식당 하나에는 고유 ID(`gm-xxxxxxxx`), 상호·지점명, 도로명/지번 주소, 위도·경도와 좌표 출처, 가이드 배지 목록이 있습니다.
배지마다 출처 URL, 확인일, 그리고 확인된 경우 선정 연도(미쉐린·백년가게)나 방송 회차·방송일(생활의 달인)을 저장합니다.

### 초기 데이터 (2026-11-24 확인)

| 가이드 | 수록 | 출처 | 좌표 |
|---|---|---|---|
| 미쉐린 | 서울 93곳 (2026 빕 구르망 51 + 스타 42) | 미쉐린 가이드 공식 사이트 레스토랑 페이지 | 공식 페이지 좌표 사용 |
| 생활의 달인 | 서울·경기 25곳 (1041~1054회) | SBS 공식 방송정보 게시판의 '방송협조' 주소 | 없음 → 목록·네이버 검색 |
| 백년가게 | 4곳 | 백년가게 누리집 현황, 중기부 선정 발표 | 없음 → 목록·네이버 검색 |
| 블루리본 | 0곳 | 이용 권한 있는 데이터 필요 | — |

여러 출처가 겹치는 지점은 120곳 중 2곳입니다: **용금옥**(미쉐린 + 백년가게), **교다이야**(미쉐린 + 생활의 달인).
용금옥은 중구 다동 본점과 종로구 통인동 지점이 따로 운영됩니다. 2022년 백년가게 선정과 미쉐린 수록은 모두 **통인동 지점**이라 이 지점에만 배지를 붙였고, 다동 본점에는 붙이지 않았습니다.

### 같은 지점 판단 규칙

- **상호(지점명 제외)와 주소 키가 모두 같을 때만** 합칩니다. 주소 키는 `시도|시군구|(일반구)|도로명|건물번호`이며, `인사동 10길`과 `인사동10길`, `창룡대로 8 번길`과 `창룡대로8번길`, `서울특별시`와 `Seoul`처럼 표기만 다른 경우를 맞춥니다. 층·호수 같은 상세주소는 비교에서 뺍니다.
- 상호가 같아도 주소가 다르면 **본점·분점을 다른 식당**으로 두고, 선정 이력을 서로 옮기지 않습니다.
- 주소가 같아도 상호가 다르면(같은 건물의 윤서울·면서울) 다른 식당입니다.
- 한쪽은 지번, 한쪽은 도로명인 경우 `address-aliases.json`에 **같은 건물로 확인된 대응**이 있을 때만 합칩니다. 대응표는 공공데이터 행에 도로명·지번이 함께 있을 때나 네이버 지오코딩 결과에서만 채웁니다. 확인되지 않으면 자동으로 합치지 않고 `meta.json`의 검토 목록(`review`)에 올립니다.

### 기존 ID 유지

- 갱신 때마다 출처 키(미쉐린 페이지 주소, 생활의 달인 회차+상호 등) → 상호+주소 키 순서로 이전 ID를 찾습니다. 그래서 주소가 바뀌어도 ID가 유지되고 `addressHistory`에 이전 주소가 남습니다.
- 이전에 따로 있던 두 ID가 같은 지점으로 합쳐지면 `idAliases`에 옛 ID → 새 ID를 기록합니다(즐겨찾기가 따라감).
- 출처에서 빠진 식당은 지우지 않고 `retired`로 옮깁니다. 다시 나타나면 같은 ID로 돌아옵니다.
- 새 ID는 상호+주소 키의 해시라, 같은 자료로 몇 번을 돌려도 같은 ID가 나옵니다.
- 기존 골목미식 데이터가 있으면 `data/restaurants.json` 자리에 두고 갱신을 돌리면 됩니다. 위 규칙대로 기존 ID를 이어받습니다.

## 데이터 갱신

### 바로 갱신(수동)

```bash
cd golmok-misik
npm run update               # 모든 출처 조회 → 검사 → 통과하면 data/ 반영
node scripts/update.mjs --only=michelin,lifemaster   # 일부 출처만
npm run update:check         # 검사만, 파일 변경 없음
npm run update:offline       # 조회 없이 sources 스냅숏만 다시 병합
```

GitHub에서는 **Actions → golmok-misik weekly data update → Run workflow**로 즉시 실행합니다(특정 출처만 고를 수 있음).

### 매주 자동 갱신

`.github/workflows/golmok-weekly-update.yml`이 **매주 화요일 02:00 UTC(한국시간 오전 11시)** 에 실행됩니다.
단위 테스트 → 갱신 → 변경이 있으면 커밋 → GitHub Pages 재배포 순서입니다.
GitHub의 예약 실행은 이 워크플로 파일이 **기본 브랜치에 있을 때만** 동작하고, 혼잡 시간에는 몇 분 늦게 시작할 수 있습니다.

### 실패해도 배포 데이터를 지키는 방식

1. 출처마다 조회합니다. **조회 실패**(네트워크·HTTP 오류·차단)나 **불완전 응답**(이전보다 30% 넘게 적거나 최소 건수 미달)이면 그 출처는 **이전 스냅숏을 그대로** 쓰고, 상태를 `failed`로 기록합니다(앱의 자료 현황에 표시).
2. 모든 출처를 병합해 **임시 폴더**에 씁니다.
3. 검사: ID 형식·중복, 같은 지점 중복, 서울·경기 범위, 좌표가 주소의 시·군·구 근처인지, 출처 URL, 확인일, 같은 출처 항목이 두 지점에 붙었는지, **기존 ID가 모두 남아 있는지**(활성·retired·idAliases), 활성 식당 수 급감.
4. 하나라도 걸리면 `data/`를 **전혀 바꾸지 않고** 종료 코드 1로 끝납니다(Actions 실패 알림, 이유는 `data/last-failed-report.json`). 통과하면 임시 파일을 한 번에 교체합니다.

### 출처별 설정

| 가이드 | 방식 | 필요한 것 |
|---|---|---|
| 미쉐린 | 공식 사이트 서울 셀렉션 목록(3·2·1스타, 빕 구르망) → 레스토랑 페이지에서 주소·좌표 | 없음 |
| 생활의 달인 | SBS 방송정보 게시판 최근 게시물의 '방송협조' 주소(서울·경기 음식점). 새 회차만 누적 | 없음 |
| 백년가게 | 공공데이터포털 [소상공인시장진흥공단_전국 백년가게 지정리스트](https://www.data.go.kr/data/15132695/fileData.do) | 저장소 Secret `DATA_GO_KR_SERVICE_KEY`(포털에서 이 데이터 **활용신청** 후 받은 일반 인증키) 또는 포털에서 내려받은 CSV를 `data/imports/baeknyeon.csv`에 저장 |
| 블루리본 | 공개 API 없음 | 이용 권한이 있는 데이터를 `data/imports/bluer.json`으로 저장. 형식: `[{"name","address","ribbons","year","sourceUrl","lat"?,"lng"?}]` |

선택: 좌표가 없는 곳을 **네이버 지오코딩**으로 채울 수 있습니다. 저장소 Secret `NCP_API_KEY_ID`, `NCP_API_KEY`(네이버 클라우드 Maps Application의 Client ID/Client Secret, Geocoding API 사용 설정)와 저장소 변수 `GOLMOK_GEOCODE=1`을 넣으세요.
결과가 정확히 1건이고 도로명 주소가 원래 주소와 일치할 때만 좌표를 쓰며(`coordSource: "naver-geocode"`), 그 외에는 좌표 없이 둡니다. 기본값은 꺼져 있습니다.

## 테스트

```bash
npm test          # 단위 테스트 41개: 주소 정규화, 병합, 검사, 갱신 파이프라인, 검색·클러스터·즐겨찾기, 출처 파서, 초기 데이터
npm run test:e2e  # 브라우저 테스트 9개(Playwright 필요: npm i -D playwright && npx playwright install chromium)
```

브라우저 테스트는 외부 네트워크 없이 돌도록 지도 타일과 네이버 지도 스크립트를 가로채고, 네이버 지도는 `tests/e2e/fake-naver-maps.js` 대역으로 대신합니다.

## 배포

정적 파일만 있으면 되므로 어느 호스팅이든 됩니다. 필요한 파일은 `index.html app.js map.js styles.css config.js lib/ vendor/ data/restaurants.json data/meta.json`입니다.

GitHub Pages:
1. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. (선택) 변수 `NAVER_MAPS_CLIENT_ID`, Secret `DATA_GO_KR_SERVICE_KEY` 등록
3. 기본 브랜치에 `golmok-misik/`이 바뀌면 `.github/workflows/golmok-pages.yml`이 배포합니다. 수동 배포는 Actions → golmok-misik pages → Run workflow.
4. 배포 주소(`https://<계정>.github.io/<저장소>/`)의 도메인을 네이버 클라우드 Web 서비스 URL에 등록

기본 지도는 OpenStreetMap 공개 타일을 씁니다. 사용량이 많아지면 [타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/)에 따라 다른 타일 제공자로 바꾸거나 네이버 지도 Client ID를 설정하세요.

## 구조

```
index.html, styles.css, app.js   화면
map.js                           지도 어댑터(네이버 지도 / Leaflet 기본 지도, 공통 클러스터링)
lib/                             브라우저·Node 공용: 주소 정규화, 병합, 검사, 검색, 클러스터, 즐겨찾기, 링크
scripts/update.mjs               갱신 파이프라인
scripts/sources/*.mjs            출처별 수집기
scripts/serve.mjs                로컬 정적 서버
tests/unit, tests/e2e            테스트
```

## 한계

- 미쉐린 가이드 한국판은 서울·부산만 발간해 경기도 미쉐린 식당은 없습니다. 미쉐린 '선정' 레스토랑은 아직 수집하지 않습니다.
- 생활의 달인은 SBS 게시판에 주소가 공개된 최근 회차만 있습니다. 게시판에 주소가 없는 초기 회차는 채우지 못합니다.
- 백년가게 전체(전국 1,511건)는 공공데이터 키나 CSV를 넣어야 반영됩니다. 지금은 직접 확인한 4곳뿐입니다.
- 블루리본은 데이터 이용 권한이 없어 0곳입니다.
- 미쉐린·SBS 사이트 구조가 바뀌거나 자동 접근을 막으면 해당 출처 수집이 실패합니다. 이때는 이전 자료를 유지하고 자료 현황에 `최근 조회 실패`로 표시합니다.
