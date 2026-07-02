# IndexNow 설정 안내

## IndexNow란?

IndexNow는 사이트의 새 콘텐츠나 변경된 URL을 검색엔진에 **즉시 알리는** 프로토콜입니다.
Bing, Naver, Seznam, Yandex 등이 지원하며, 한 곳(api.indexnow.org)에 전송하면 참여 검색엔진 전체에 공유됩니다.
사이트맵 크롤링을 기다리지 않고 색인 요청을 빠르게 넣을 수 있습니다.

## 키 파일 (중요)

- 인증 키: `72623852f17d4eb341d4cd3755d3ba64`
- 키 파일: `public/72623852f17d4eb341d4cd3755d3ba64.txt`
- 배포 후 `https://metatake.net/72623852f17d4eb341d4cd3755d3ba64.txt` 로 접근 가능해야 합니다.
- **이 파일은 반드시 사이트 루트에 유지되어야 합니다.** 삭제하거나 이동하면 IndexNow 제출이 모두 거부됩니다.

## 실행 방법

사이트맵의 모든 URL 제출:

```bash
npm run indexnow -- --sitemap
```

특정 URL만 제출:

```bash
npm run indexnow -- https://metatake.net/curio/some-slug
```

실제 전송 없이 미리보기 (dry run):

```bash
npm run indexnow -- --dry-run --sitemap
```

- URL은 500개 단위 배치로 `https://api.indexnow.org/indexnow` 에 POST 됩니다.
- 배치별 HTTP 응답 상태가 로그에 출력됩니다. (200 = 성공, 202 = 접수됨)

## 언제 실행하나?

- **새 콘텐츠를 배치로 발행한 직후** 실행하는 것이 가장 효과적입니다.
- 기존 페이지를 대량 수정했을 때도 실행하세요.
- 변경이 없는데 반복 제출하는 것은 의미가 없으니 피하세요 (스팸으로 간주될 수 있음).
