# Roadmap: English Assist App

App cá nhân hỗ trợ giao tiếp tiếng Anh (chủ yếu trên Discord): sửa câu, gợi ý câu nói, tra cụm từ, ôn tập lỗi và vocab.

**Stack:** Next 16 (App Router) · Vercel AI SDK + `@ai-sdk/amazon-bedrock` · Claude Haiku 4.5 · Prisma + Supabase (Postgres + Auth) · Tailwind 4

**Nguyên tắc:** ưu tiên độ trễ (stream < ~1s), output ngắn và nói được, thao tác hoàn toàn bằng bàn phím.

---

## Tính năng chính

### Mode (mỗi mode có system prompt và schema riêng)

| Mode          | Input                                      | Output                                                           |
| ------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| **Fix**       | Câu định nói                               | Câu đã sửa, highlight lỗi, giải thích, 1–2 cách nói tự nhiên hơn |
| **Keywords**  | `lag, game, server, yesterday`             | 2–3 câu hoàn chỉnh                                               |
| **Describe**  | Mô tả ý bằng tiếng Việt hoặc tiếng Anh bồi | 2–3 câu nói được ngay                                            |
| **Reply**     | Câu người khác vừa nói, kèm ý muốn trả lời | 2–3 cách đáp                                                     |
| **Try first** | Tự viết câu trước                          | Chấm điểm, sửa và lưu lại để ôn                                  |

- Toggle **tone**: casual / neutral / polite
- Option **spoken/short**: câu ngắn, dễ nói trong voice room

### Highlight lỗi

- LLM trả `{ corrected, alternatives, edits[{ original, replacement, type, explanation }] }`, **không** trả vị trí ký tự.
- Client diff theo từng từ (`diff`/jsdiff) giữa input và `corrected` để render highlight, sau đó match `edits[].original` để gắn giải thích.
- Chỉ áp dụng cho mode Fix và Try first. Đặt `corrected` là field đầu tiên để stream ra trước; highlight render khi output đã xong.

### Bôi đen → action

- Các action: Translate · Meaning in context · Synonyms · Collocations · Examples · **Save to vocab**
- Chỉ gọi khi user chọn action, luôn gửi kèm câu chứa cụm từ làm context, dùng model rẻ nhất.
- Cache theo `hash(action, phrase, context)` trong bảng `PhraseLookup`.

### Ôn tập

- History: xem lại, tìm kiếm, dùng lại
- Mistakes: thống kê lỗi theo type, top lỗi lặp lại
- Flashcard vocab theo FSRS (`ts-fsrs`)

### UX

- Focus sẵn ô input · `Ctrl+Enter` gửi · `1/2/3` copy lựa chọn · `Tab` đổi mode
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
- [x] Phím tắt: `⌘/Ctrl+Enter` gửi · `1/2/3` copy (`⌥1–3` khi đang gõ) · `/` quay lại ô nhập · `Esc` dừng stream
- Đo thử: `corrected` bắt đầu hiện sau ~1–1.4s, xong sau ~2–3s (Bedrock thỉnh thoảng chậm đột biến ~4s)
- **Xong khi:** trong ~1 giây thấy câu đã sửa có highlight, copy được bằng một phím. Sau đó **dùng thật trên Discord khoảng 1 tuần** rồi mới làm tiếp.

### Phase 2: Đủ các mode, kèm lịch sử

- [ ] Các mode Keywords, Describe, Reply (`lib/ai/modes/*`)
- [ ] Option spoken/short
- [ ] Lưu `Session` và `Edit` sau khi stream xong (`onFinish`)
- [ ] Trang History
- [ ] Bộ khoảng 20 input mẫu cho mỗi mode để test lại prompt

### Phase 3: Bôi đen và action

- [ ] Popover khi bôi đen, modal hiển thị kết quả
- [ ] Cache `PhraseLookup`
- [ ] Save to vocab

### Phase 4: Vòng học tập

- [ ] Trang Mistakes
- [ ] Trang Review (flashcard FSRS)
- [ ] Mode Try first

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
  createdAt DateTime @default(now())
  edits     Edit[]
  @@index([userId, createdAt])
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

enum Mode     { FIX KEYWORDS DESCRIBE REPLY TRY_FIRST }
enum Tone     { CASUAL NEUTRAL POLITE }
enum EditType { SPELLING GRAMMAR WORD_CHOICE NATURALNESS }
```
