# Metatake — Back-Silhouette Image Prompt

For regenerating the cinema back-silhouette with an AI image generator (Midjourney, DALL·E 3, Sora/Images, Ideogram, Flux, etc.). Portrait / 세로 (4:5).

## English prompt (primary)

> Photorealistic photograph, shot from directly behind a single person sitting in a dark movie theater, head and shoulders silhouette filling the lower-center of the frame, facing a large glowing cinema screen. The screen shows a soft, heavily out-of-focus film still — warm amber and cool teal bokeh, gentle defocused light. The figure is a clean black silhouette with a faint cool rim light from the screen catching the top of the head and shoulders. Subtle projector haze, a few dust motes in the light. Foreground rows of dark, out-of-focus seat backs. Cinematic, moody, quiet, contemplative. Real photo, 35mm, shallow depth of field, fine film grain, soft vignette, natural lens bloom, no text, no logos. Portrait orientation 4:5.

**Negative / avoid:** faces, facial features, eyes, distorted anatomy, cartoon, illustration, 3D render look, harsh white blown-out screen, text, watermark, extra limbs.

**Settings:** aspect ratio 4:5 (or `--ar 4:5` in Midjourney), high detail, photographic style. For Midjourney add `--style raw --ar 4:5`.

## 한국어 프롬프트

> 어두운 영화관에서 한 사람을 바로 뒤에서 찍은 실사 사진. 머리와 어깨의 실루엣이 화면 하단 중앙을 채우고, 인물은 빛나는 큰 스크린을 마주 보고 있다. 스크린에는 초점이 크게 흐려진 영화 한 장면 — 따뜻한 앰버와 시원한 청록색 보케, 부드러운 빛. 인물은 깨끗한 검은 실루엣이며, 스크린 빛이 머리와 어깨 윤곽에 옅은 림라이트로 걸린다. 은은한 영사기 빛 산란과 빛 속 먼지 입자. 앞쪽에는 초점이 나간 어두운 좌석 등받이 줄. 영화적이고 정적이며 사색적인 분위기. 진짜 사진, 35mm, 얕은 심도, 고운 필름 그레인, 부드러운 비네팅, 자연스러운 렌즈 블룸. 글자·로고 없음. 세로 4:5 비율.

**피해야 할 것:** 얼굴·이목구비, 일그러진 인체, 만화/일러스트, 3D 렌더 느낌, 새하얗게 날아간 스크린, 텍스트, 워터마크.

## Variations to try
- "looking up at the screen, slightly low camera angle"
- Single bright key blob behind the head for stronger silhouette contrast
- Cooler grade (blue/teal) for a more minimal look; warmer (amber) for a richer cinema feel
- Wider 16:9 crop for a home/hero banner; 1:1 for social

## Note
The two JPGs in this folder (`metatake_silhouette_minimal.jpg`, `metatake_silhouette_warm.jpg`) were rendered procedurally with `cinema_silhouette_render.py` — no external photo or model. Re-run `python3 cinema_silhouette_render.py <seed>` (e.g. `7`, `3`, or any integer) to get new variants.
