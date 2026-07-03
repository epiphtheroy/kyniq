import { redirect } from "next/navigation";

/** v2: 운용 데스크는 홈에 흡수 — 오늘의 한 편·후보·쓰기 경로가 /room으로 승격됨.
 *  라우트는 북마크 호환을 위해 redirect로 유지 (watcher 스테이징 범위 안 = app/). */
export default function RoomDeskRedirect() {
  redirect("/room");
}
