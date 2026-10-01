# Roadmap: Lingo

App cá nhân hỗ trợ giao tiếp tiếng Anh (chủ yếu trên Discord): sửa câu, gợi ý câu nói, tra cụm từ, ôn tập lỗi và vocab.

**Stack:** Next 16 (App Router) · Vercel AI SDK + `@ai-sdk/amazon-bedrock` · Claude Haiku 4.5 · Prisma + Supabase (Postgres + Auth) · Tailwind 4

**Nguyên tắc:** ưu tiên độ trễ (stream < ~1s), output ngắn và nói được, thao tác hoàn toàn bằng bàn phím.

---

## Tính năng chính

### Mode

| Mode        | Input                                                                             | Output                                                                 |
| ----------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Fix**     | Câu tiếng Anh định nói                                                            | Câu đã sửa, highlight lỗi, giải thích, 1–2 cách nói tự nhiên hơn       |
| **Suggest** | Mô tả ý bằng tiếng Việt, hoặc các từ tiếng Anh rời rạc (`lag, server, yesterday`) | 2–3 câu hoàn chỉnh nói được ngay, kèm giải thích từ và cụm từ đáng học |

- Toggle **tone**: casual / neutral / polite

### Highlight lỗi

- LLM trả `{ corrected, alternatives, edits[{ original, replacement, type, explanation }] }`, **không** trả vị trí ký tự.
- Client diff theo từng từ (`diff`/jsdiff) giữa input và `corrected` để render highlight, sau đó match `edits[].original` để gắn giải thích.
- Chỉ áp dụng cho mode Fix. Đặt `corrected` là field đầu tiên để stream ra trước; highlight render khi output đã xong.

### Bôi đen → action

- Các action: Translate · Meaning in context · Synonyms · Collocations · Examples · **Save to vocab**
- Chỉ gọi khi user chọn action, luôn gửi kèm câu chứa cụm từ làm context, dùng model rẻ nhất.
- Cache theo `hash(action, phrase, context)` trong bảng `PhraseLookup`.

### Ôn tập

- History: xem lại, tìm kiếm, dùng lại
- Mistakes: thống kê lỗi theo type, top lỗi lặp lại
- Flashcard vocab theo FSRS (`ts-fsrs`)

### Suggest: giải thích từ và cụm từ

- Suggest **không** sửa lỗi input (input là ý, không phải câu để sửa).
- LLM trả `{ suggestions: string[], vocab[{ phrase, meaning }] }`: `suggestions` đứng trước để stream ra trước.
- `vocab` chỉ gồm từ ít phổ biến, phrasal verb, collocation, idiom, slang/cách nói gaming có trong các câu gợi ý (tối đa 4, có thể rỗng). Bỏ qua từ cơ bản.
- `phrase` là đoạn ngắn nhất mang nghĩa, chép nguyên văn từ câu gợi ý để client gạch chân (`lib/assist/phrases.ts`, không phân biệt hoa thường, khớp nguyên từ) và hiện tooltip; `meaning` viết bằng tiếng Việt, ngắn, ghi rõ nếu là slang.
- Về sau (Phase 3) mỗi mục `vocab` có nút **Save to vocab**.

### UX

- Focus sẵn ô input · `Ctrl+Enter` gửi · `1/2/3` copy lựa chọn · `R` regenerate · `Tab` đổi mode
- PWA để mở như một cửa sổ riêng cạnh Discord

---

## Phase

### Phase 0: Nền tảng

- [x] AWS: Bedrock API key, Haiku 4.5 qua `global.anthropic.claude-haiku-4-5-20251001-v1:0` (profile `apac.*` không có cho Haiku 4.5)
- [x] AWS Budget alert **$5/tháng**
- [x] Prisma 7.10 + adapter-pg, schema đầy đủ, migration `init` + bật RLS cho mọi bảng (chặn Supabase Data API)
- [x] `lib/ai/models.ts` (ModelRouter), `lib/db.ts` (Prisma singleton)
- [x] Supabase Auth email/password: `proxy.ts` (refresh session + redirect), `lib/auth.ts` (`getCurrentUser`/`requireUser`), allowlist `ALLOWED_EMAILS`, trang `/login`
- [x] Supabase dashboard: tắt signup, tạo user, điền `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` + `ALLOWED_EMAILS`
- **Xong khi:** đăng nhập được, `/api/ai-check` trả về text

### Phase 1: MVP, mode Fix

- [x] `POST /api/assist` dùng `streamText` + `Output.object` (AI SDK 7 thay cho `streamObject`) với schema Fix, `structuredOutputMode: 'outputFormat'` để thật sự stream
- [x] UI: input, tone (lưu localStorage), output stream qua `useObject`, copy
- [x] Highlight diff (`lib/assist/highlight.ts`) và tooltip giải thích, kèm danh sách edits bên dưới
- [x] Phím tắt: `⌘/Ctrl+Enter` gửi · `1/2/3` copy · `/` quay lại ô nhập · `Esc` dừng stream
- Đo thử: `corrected` bắt đầu hiện sau ~1–1.4s, xong sau ~2–3s (Bedrock thỉnh thoảng chậm đột biến ~4s)
- **Xong khi:** trong ~1 giây thấy câu đã sửa có highlight, copy được bằng một phím. Sau đó **dùng thật trên Discord khoảng 1 tuần** rồi mới làm tiếp.

### Phase 2: Mode Suggest, kèm lịch sử

- [x] Mode Suggest (`lib/ai/modes/suggest.ts`): system prompt và `suggestResultSchema` như mục "Suggest: giải thích từ và cụm từ"
- [x] `lib/ai/modes/index.ts`: bảng `mode → { task, instructions, schema, temperature }`. Route `/api/assist` chọn theo mode; `saveSession` lưu mọi mode (Edit chỉ có ở Fix)
- [x] Request schema `mode: 'fix' | 'suggest'`; migration `mode_fix_suggest`: enum `Mode` còn `FIX | SUGGEST`
- [x] UI Suggest: 2–3 câu (`1/2/3` copy), cụm từ trong `vocab` gạch chân kèm tooltip, danh sách "Words & phrases" bên dưới. `Tab` / `Shift+Tab` đổi mode khi đang ở ô nhập hoặc không focus gì (`Esc` để rời ô nhập), mode lưu localStorage, đổi mode giữ input nhưng xóa kết quả
- [x] History hai mode: badge mode, lọc theo mode (`?mode=`), tìm cả trong `suggestions`, copy câu đầu tiên. `/?session=<id>` khôi phục đúng mode, tone và kết quả
- [x] Route chọn sẵn id session (bản cache hoặc bản sẽ bị Regenerate ghi đè thì dùng lại id cũ) và trả qua header `x-assist-session`; stream xong có kết quả thì client ghi `?session=<id>` lên URL, reload hoặc gửi link là mở lại đúng câu trả lời
- [x] Test (Vitest + Playwright) cho Suggest, cache key theo mode và History hai mode
- [x] Lưu `Session` và `Edit` sau khi stream xong (`result.output` + `after()`); stream bị dừng hoặc lỗi thì không lưu
- [x] Cache: `Session.cacheKey = sha256(mode, tone, input đã gộp khoảng trắng, model, system prompt, JSON schema)`. Gặp lại đúng key thì trả output cũ, không gọi model (UI hiện `cached`). Sửa prompt/schema/model là cache tự mất hiệu lực. Nút **Regenerate** (phím `R`) gửi `fresh: true` để bỏ qua cache, câu trả lời mới thay cho bản cũ
- [x] Trang History (`/history`): tìm theo input hoặc câu đã sửa (`?q=`), phân trang cursor 30 mục/trang, copy câu. Bấm một mục mở `/?session=<id>`: trang Assist hiện lại đúng input, tone và kết quả đã lưu, không gọi model
- **Xong khi:** Fix và Suggest dùng được hoàn toàn bằng bàn phím, kết quả được cache, lưu vào History và mở lại đúng trạng thái

### Phase 3: Bôi đen và action

- [ ] Popover khi bôi đen, modal hiển thị kết quả
- [ ] Cache `PhraseLookup`
- [ ] Save to vocab

### Phase 4: Vòng học tập

- [ ] Trang Mistakes
- [ ] Trang Review (flashcard FSRS)

### Phase 5: Hoàn thiện (tùy chọn)

- [x] Dark mode với `next-themes`: light / dark / system
- [ ] PWA, nhập bằng giọng nói (Web Speech API)
- [ ] Rate limit, thống kê token/chi phí
- [ ] Discord bot slash command trong server riêng (**không** làm self-bot, vi phạm ToS)

---

## Lưu ý kỹ thuật

**Prisma + Supabase**

- `DATABASE_URL`: pooler port 6543 (transaction mode) cho runtime · `DIRECT_URL`: port 5432 cho migrate
- Prisma kết nối bằng role `postgres` nên **bỏ qua RLS**: mọi query phải lọc theo `userId` ở server
- Chỉ dùng Supabase cho Postgres + Auth, không truy cập data qua supabase-js
- Không format file trong `prisma/migrations/` (đã ignore trong `.oxfmtrc.json`): sửa dù chỉ khoảng trắng cũng làm lệch checksum, `migrate dev` sẽ đòi reset DB
- Prisma bản mới dùng `prisma.config.ts` + driver adapter (`@prisma/adapter-pg`): làm theo docs hiện tại
- Project Supabase gói free tự pause sau khoảng 1 tuần không dùng

**Next 16**

- `middleware.ts` đã đổi thành `proxy.ts`
- Đọc `node_modules/next/dist/docs/` trước khi code

**Bedrock**

- Region gần: `ap-southeast-1` hoặc cross-region inference profile
- Nova Micro/Lite rẻ hơn nhưng cần test chất lượng dịch Anh–Việt trước khi dùng cho các action
- Chi phí ước tính khoảng $0.001/request với Haiku 4.5, dùng cá nhân chỉ vài đô/tháng

---

## Phác thảo Prisma schema

```prisma
model Session {
  id        String   @id @default(cuid())
  userId    String   @db.Uuid            // auth.users.id của Supabase
  mode      Mode
  tone      Tone
  input     String
  output    Json
  model     String
  latencyMs Int?
  cacheKey  String                       // hash(mode, tone, input, model, prompt, schema)
  createdAt DateTime @default(now())
  edits     Edit[]
  @@index([userId, createdAt])
  @@index([userId, cacheKey])
}

model Edit {
  id          String   @id @default(cuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String   @db.Uuid
  original    String
  replacement String
  type        EditType
  explanation String
  @@index([userId, type])
}

model VocabItem {
  id         String    @id @default(cuid())
  userId     String    @db.Uuid
  phrase     String
  context    String?
  meaning    String?
  notes      Json?
  due        DateTime  @default(now())   // FSRS state
  stability  Float     @default(0)
  difficulty Float     @default(0)
  reps       Int       @default(0)
  lapses     Int       @default(0)
  state      Int       @default(0)
  lastReview DateTime?
  createdAt  DateTime  @default(now())
  @@unique([userId, phrase])
  @@index([userId, due])
}

model PhraseLookup {
  key       String   @id                 // hash(action, phrase, context)
  action    String
  phrase    String
  result    Json
  createdAt DateTime @default(now())
}

enum Mode     { FIX SUGGEST }
enum Tone     { CASUAL NEUTRAL POLITE }
enum EditType { SPELLING GRAMMAR WORD_CHOICE NATURALNESS }
```
