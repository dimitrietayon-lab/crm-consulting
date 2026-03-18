# Plan: Task Document Uploads

Decisions
- Scope: Only extend TaskDetailModal for uploads
- Document category: Task
- Deletion policy: Keep documents when task is deleted (DB FK onDelete=SetNull)

Database Changes
- Edit [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
  - In Document model add:
    - taskId String?
    - task Task? @relation(fields: [taskId], references: [id], onDelete: SetNull)
  - In Task model add:
    - documents Document[]

Migration Steps
- Run: cd backend && npx prisma migrate dev -n add_task_documents && npx prisma generate
- Verify: Column document.taskId exists, and relations compile

Backend Changes
- Tasks Route: [backend/src/routes/tasks.js](backend/src/routes/tasks.js)
  - Add multer disk storage using UPLOAD_DIR (reuse pattern from documents/projects routes)
  - POST /api/tasks
    - Accept multipart and JSON: use upload.array('files') middleware
    - Create task from fields; coerce dueDate to Date if present
    - For each uploaded file, create prisma.document with:
      - name = originalname
      - category = 'Task'
      - filePath, fileSize, mimeType from multer
      - taskId = created task id
      - accountId = task.accountId (if any)
      - projectId = task.projectId (if any)
      - uploadedById = req.user?.id
    - Return task with includes
  - PUT /api/tasks/:id
    - Accept multipart via upload.array('files')
    - Update task fields (handle dueDate); then if files present, create Document rows as above using latest task state
    - Return task with includes
  - Include on responses:
    - assignedTo { id, name }
    - account { id, companyName }
    - project { id, name }
    - contact { id, name }
    - documents: orderBy createdAt desc
- Documents Route: [backend/src/routes/documents.js](backend/src/routes/documents.js)
  - GET /api/documents: add taskId query filter support
  - Include task { id, title } in include for global listing

Frontend Changes
- API helper: [frontend/lib/api.js](frontend/lib/api.js)
  - Add api.uploadPut(path, formData) sending method='PUT' without Content-Type header
- Task Detail Modal: [frontend/components/tasks/TaskDetailModal.jsx](frontend/components/tasks/TaskDetailModal.jsx)
  - UI: Add input type="file" multiple, persisted state of selected files
  - Data: On open, fetch existing documents via GET /documents?taskId=TASK_ID and show as list with download links to /api/documents/:id/download
  - Save: Switch to FormData-based PUT; append all scalar fields; append each selected file under key 'files'
- Documents Page: [frontend/app/(protected)/documents/page.jsx](frontend/app/(protected)/documents/page.jsx)
  - In document item rendering, if doc.task or doc.taskId present, render a small Task badge with the task title

API Contract
- Upload on task create/update
  - Files key: files (multiple)
  - Scalar fields: title, description, status, priority, dueDate, assignedToId, accountId, projectId, recurring
- List documents linked to a task
  - GET /api/documents?taskId={TASK_ID}
  - Response items include task { id, title }

Testing & Verification
- Backend
  - Unit smoke: create task via JSON; update via multipart with two files; expect 201/200 and documents created
  - Delete a task; ensure documents remain and have taskId null (or unchanged if not SetNull until taskId cleared)
- Frontend
  - Open a task; upload two files; saved; list appears with both files and download works
  - Global Documents page shows Task badge with task title

Mermaid
```mermaid
flowchart LR
  UI[TaskDetailModal] -->|FormData PUT /api/tasks/:id files[]| API[Express tasks route]
  API -->|disk write| FS[UPLOAD_DIR]
  API -->|create rows| DB[(Prisma Document)]
  DocsPage[Documents Page] -->|GET /api/documents?taskId| API
  API --> DocsPage
```

Files to Modify
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- [backend/src/routes/tasks.js](backend/src/routes/tasks.js)
- [backend/src/routes/documents.js](backend/src/routes/documents.js)
- [frontend/lib/api.js](frontend/lib/api.js)
- [frontend/components/tasks/TaskDetailModal.jsx](frontend/components/tasks/TaskDetailModal.jsx)
- [frontend/app/(protected)/documents/page.jsx](frontend/app/(protected)/documents/page.jsx)

Out of Scope
- Extending Create Task modal with uploads
- Deleting documents from Task modal

