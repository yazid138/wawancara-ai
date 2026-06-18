# Alur Logic: `GET /interviews/:id/current`

## Ringkasan

Endpoint ini digunakan untuk mengambil pertanyaan **saat ini** (current question) dari sebuah sesi interview yang sedang berjalan. Jika semua pertanyaan sudah terjawab, endpoint ini secara otomatis menyelesaikan (finish) interview tersebut.

---

## Informasi Endpoint

| Atribut       | Detail                                    |
|---------------|-------------------------------------------|
| **Method**    | `GET`                                     |
| **Path**      | `/interviews/:id/current`                 |
| **Route File**| `src/routes/interview.route.ts`           |
| **Controller**| `InterviewController.getCurrent`          |
| **Service**   | `interviewService.getInterviewById`, `interviewService.getNextQuestion`, `interviewService.finishInterview`, `interviewService.processResume` |

---

## Alur Logic

### Diagram Alur

```mermaid
flowchart TD
    A(["Client\nGET /interviews/:id/current"]) --> B["Route Layer\ninterview.route.ts"]
    B --> C["Controller: getCurrent\nParse id dari URL params"]

    C --> D[("Prisma\ninterview.findUnique\nwhere: id")]
    D --> E{"Interview\nditemukan?"};

    E -- Tidak --> F["throw NotFoundException\n'Interview tidak ditemukan'"]
    F --> G(["HTTP 404"])

    E -- Ya --> H{"status\n=== FINISH?"}
    H -- Ya --> I["throw ForbiddenException\n'Interview sudah selesai'"]
    I --> J(["HTTP 403"])

    H -- Tidak --> K["getNextQuestion(id)\n[lihat diagram detail]"];

    K --> L{"question\nditemukan?"};

    L -- Ada pertanyaan --> M(["sendResponse 200\n'Pertanyaan saat ini'\ndata: question"])

    L -- null / semua habis --> N["finishInterview(id)\nPrisma: status → FINISH"]
    N --> O["processResume(id)\n🔄 background async"];
    O --> P(["sendResponse 200\n'Interview selesai'\ndata: null"])

    style F fill:#f87171,color:#fff
    style I fill:#f87171,color:#fff
    style G fill:#dc2626,color:#fff
    style J fill:#dc2626,color:#fff
    style M fill:#4ade80,color:#1a1a1a
    style P fill:#60a5fa,color:#fff
    style O stroke:#f59e0b,stroke-dasharray: 5 5
```

---

### Detail: `interviewService.getNextQuestion(id)`

Fungsi ini menggunakan **generation lock** (`generationLocks` Map) untuk mencegah concurrent call menghasilkan pertanyaan duplikat.

```mermaid
flowchart TD
    A(["getNextQuestion(interviewId)"]) --> B{"generationLocks\nmemiliki interviewId?"}
    B -- Ya --> C(["return promise\nyang sudah ada"])
    B -- Tidak --> D["Buat promise baru\nsimpan ke Map"]
    D --> E["_getNextQuestion(interviewId)"]
    E --> F[("Prisma: interview.findUnique\ninclude: user, company, position,\nfocusQuestions, chatHistories, answers")]
    F --> G{"Interview\nada?"}
    G -- Tidak --> H(["return null"])

    G -- Ya --> I{"lastChat.role\n=== 'AI'?"}
    I -- Ya, belum dijawab --> J{"lastChat\n.questionId == null?"}
    J -- Ya --> K(["return\n{ id: -1, type: INTRO, content }"])
    J -- Tidak --> L(["return\n{ ...question, content: lastChat.content }"])

    I -- Tidak --> M["Hitung countByType\n& softskillCountByCategory\n& usedQuestionIds"]

    M --> N["Loop FLOW:\nINTRO → GENERAL → SOFTSKILL → TECHNICAL"]

    N --> O{"INTRO\nremaining > 0?"}
    O -- Ya --> O1["generateIntroMessage [AI]\nSimpan chatHistories"]
    O1 --> O2(["return { id: -1, type: INTRO }"])
    O -- Tidak --> P

    P{"GENERAL\nremaining > 0?"} -- Ya --> P1["Fetch candidates WHERE type=GENERAL\nPilih pseudo-random\nrephraseQuestion [AI]"]
    P1 --> P2(["return { ...question, content: rephrase }"])
    P -- Tidak --> Q

    Q{"SOFTSKILL\nvalidCandidates\nada?"} -- Ya --> Q1["Filter: max 3/kategori\nPrioritaskan kategori baru\nPilih pseudo-random\nrephraseQuestion [AI]"]
    Q1 --> Q2(["return { ...question, content: rephrase }"])
    Q -- Tidak --> R

    R{"TECHNICAL\nremaining > 0?"} -- Ya --> R1["Fetch candidates WHERE type=TECHNICAL\nPilih pseudo-random\nrephraseQuestion [AI]"]
    R1 --> R2(["return { ...question, content: rephrase }"])
    R -- Tidak --> S(["return null\n(semua pertanyaan selesai)"])

    style H fill:#94a3b8,color:#fff
    style C fill:#a78bfa,color:#fff
    style K fill:#34d399,color:#1a1a1a
    style L fill:#34d399,color:#1a1a1a
    style O2 fill:#34d399,color:#1a1a1a
    style P2 fill:#34d399,color:#1a1a1a
    style Q2 fill:#34d399,color:#1a1a1a
    style R2 fill:#34d399,color:#1a1a1a
    style S fill:#f87171,color:#fff
```

---

## Distribusi Pertanyaan (`DISTRIBUTION`)

| Tipe         | Jumlah Maksimum                     |
|--------------|-------------------------------------|
| `INTRO`      | 1                                   |
| `GENERAL`    | 1                                   |
| `SOFTSKILL`  | `∞` (dikontrol per-kategori: max **3 per kategori**) |
| `TECHNICAL`  | 3                                   |

Urutan alur pertanyaan (FLOW): `INTRO → GENERAL → SOFTSKILL → TECHNICAL`

---

## Response

### Pertanyaan ditemukan (Interview masih berjalan)

```json
{
  "status": 200,
  "message": "Pertanyaan saat ini",
  "data": {
    "id": 42,
    "content": "Ceritakan pengalaman Anda menggunakan React hooks...",
    "type": "TECHNICAL",
    "categoryId": 3
  }
}
```

### Pertanyaan INTRO (belum pernah ada chat AI)

```json
{
  "status": 200,
  "message": "Pertanyaan saat ini",
  "data": {
    "id": -1,
    "content": "Halo Budi! Selamat datang di sesi interview...",
    "type": "INTRO"
  }
}
```

### Semua pertanyaan habis (Interview selesai otomatis)

```json
{
  "status": 200,
  "message": "Interview selesai",
  "data": null
}
```

---

## Error Cases

| Kondisi                              | Exception               | HTTP Status |
|--------------------------------------|-------------------------|-------------|
| `id` tidak ditemukan di database     | `NotFoundException`     | 404         |
| `interview.status === FINISH`        | `ForbiddenException`    | 403         |

---

## Side Effects

Ketika `getNextQuestion` mengembalikan `null` (semua soal habis):

1. **`finishInterview(id)`** — Update `interview.status` menjadi `FINISH` di database (operasi **sync**, ditunggu).
2. **`processResume(id)`** — Generate ringkasan interview menggunakan AI berdasarkan seluruh Q&A history (operasi **background/async**, error di-log ke `console.error` dan tidak memengaruhi response).

---

## File Terkait

| File | Deskripsi |
|------|-----------|
| [`src/routes/interview.route.ts`](../src/routes/interview.route.ts) | Definisi route |
| [`src/controller/interview.controller.ts`](../src/controller/interview.controller.ts) | Handler `getCurrent` (baris 61–91) |
| [`src/services/interview.service.ts`](../src/services/interview.service.ts) | `getNextQuestion` / `_getNextQuestion` (baris 144–334) |
