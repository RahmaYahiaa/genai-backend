// Plain-language title and description for every route, shown in Swagger.
// Keep the wording simple. The same texts are used in the Postman collection.
export const ROUTE_TEXTS = {
  'GET /health': {
    summary: "Health check",
    description: "Returns ok when the server and the database are up. No sign-in needed.",
  },
  'POST /auth/login': {
    summary: "Sign in",
    description: "Email and password. Returns the tokens and the user. New accounts must verify their email first.",
  },
  'POST /auth/register': {
    summary: "Sign up",
    description: "role student: add institutionId to join a university, leave it out for a personal account. role institution_admin: creates a new institution (institutionName required). Then enter the emailed code in Verify email.",
  },
  'GET /auth/registration-guidance': {
    summary: "Which sign-up fits this email?",
    description: "Tells the sign-up page whether an email belongs to a registered institution. No sign-in needed.",
  },
  'POST /auth/verify-email': {
    summary: "Verify email",
    description: "Enter the 6-digit code sent by email right after sign-up. Codes last 15 minutes, 5 tries.",
  },
  'POST /auth/verify-email/resend': {
    summary: "Send a new verification code",
    description: "Sends a new code. Wait 60 seconds between sends (max 3 every 15 minutes).",
  },
  'POST /auth/forgot-password': {
    summary: "Forgot password",
    description: "Emails a 6-digit reset code. Always answers the same way, so nobody can check which emails have accounts.",
  },
  'POST /auth/reset-password': {
    summary: "Reset password",
    description: "Sets a new password using the emailed code. Signs out all other sessions and sends a \"password changed\" email.",
  },
  'POST /auth/refresh': {
    summary: "Refresh token",
    description: "Gets a new token pair using refreshToken. The old refresh token stops working.",
  },
  'GET /auth/me': {
    summary: "My profile",
    description: "The signed-in user.",
  },
  'PATCH /auth/me': {
    summary: "Update my profile",
    description: "Change first name, last name or interface language (en / ar).",
  },
  'POST /auth/logout': {
    summary: "Sign out",
    description: "Ends every session of this user.",
  },
  'GET /invitations/{token}': {
    summary: "Open invitation link",
    description: "Shows who is invited, by which institution and to which courses. No sign-in needed.",
  },
  'POST /invitations/{token}/accept': {
    summary: "Accept invitation",
    description: "The invited person sets a password and is signed in, with their courses ready. No sign-in needed.",
  },
  'GET /link-invitations': {
    summary: "My link invitations (student)",
    description: "A personal student sees universities asking to link their account.",
  },
  'POST /link-invitations/{invitationId}/respond': {
    summary: "Accept or decline linking (student)",
    description: "accept turns the account into a university account (personal courses are kept). decline changes nothing.",
  },
  'GET /admin/me': {
    summary: "Me and my permissions",
    description: "The signed-in admin, their permissions and the ready-made permission templates.",
  },
  'GET /admin/health': {
    summary: "What needs attention",
    description: "Waiting join requests, unaccepted invitations, courses without files, subscription days left.",
  },
  'GET /admin/analytics': {
    summary: "Reports",
    description: "Students, lecturers and courses per faculty, and how actively the platform is used.",
  },
  'GET /admin/users': {
    summary: "List people",
    description: "All accounts in the institution.",
  },
  'PATCH /admin/users/{userId}/active': {
    summary: "Pause or activate account",
    description: "isActive false pauses the account (it cannot sign in). true activates it again.",
  },
  'PATCH /admin/users/{userId}/role': {
    summary: "Change role",
    description: "student, instructor or institution_admin.",
  },
  'PATCH /admin/users/{userId}/academic-number': {
    summary: "Set academic number",
    description: "Student or staff number. Send null to clear it.",
  },
  'PATCH /admin/users/{userId}/study-year': {
    summary: "Set study year",
    description: "1 to 4. Decides which courses the student can join without a request. Send null to clear it.",
  },
  'GET /admin/officers': {
    summary: "List admin team",
    description: "Every admin in the institution with their permissions.",
  },
  'POST /admin/officers': {
    summary: "Add an officer",
    description: "Creates an officer with a template or chosen permissions and emails them an invitation.",
  },
  'PATCH /admin/officers/{userId}/template': {
    summary: "Apply a permission template",
    description: "tpl-admissions or tpl-content.",
  },
  'PATCH /admin/officers/{userId}/scopes': {
    summary: "Set exact permissions",
    description: "Replaces the officer permissions with this list.",
  },
  'POST /admin/imports': {
    summary: "Step 1 - Check the list",
    description: "Send the rows from the CSV/Excel file. Each row comes back as new (will get an email), existing (joins directly) or error. Nothing is sent yet.",
  },
  'POST /admin/imports/{batchId}/confirm': {
    summary: "Step 2 - Send invitations",
    description: "Emails every new person a personal link and adds existing accounts to their courses.",
  },
  'DELETE /admin/imports/{batchId}': {
    summary: "Discard the list",
    description: "Cancels a list that was checked but not sent.",
  },
  'GET /admin/imports': {
    summary: "Import history",
    description: "Every list uploaded, newest first.",
  },
  'GET /admin/invitations': {
    summary: "List invitations",
    description: "Each invitation with its state and whether the email was delivered. status: pending, accepted or revoked.",
  },
  'POST /admin/invitations/{invitationId}/resend': {
    summary: "Send invitation again",
    description: "Sends a new link. The old link stops working.",
  },
  'POST /admin/invitations/{invitationId}/revoke': {
    summary: "Cancel invitation",
    description: "The link stops working and shows \"cancelled\".",
  },
  'GET /admin/requests': {
    summary: "List join requests",
    description: "status: PENDING, APPROVED or REJECTED.",
  },
  'GET /admin/requests/{requestId}/proof': {
    summary: "Download attached proof",
    description: "The file the student attached, if any.",
  },
  'POST /admin/requests/{requestId}/decision': {
    summary: "Approve or reject",
    description: "APPROVED adds the student to the course. REJECTED needs a note. The student gets an email either way.",
  },
  'GET /admin/profile': {
    summary: "Get profile",
    description: "Name, description, mission, vision, contact details and faculties.",
  },
  'PATCH /admin/profile': {
    summary: "Update profile",
    description: "Send only what changes. faculties replaces the whole list.",
  },
  'GET /admin/settings': {
    summary: "Get settings",
    description: "Email domains, self sign-up, whether instructors can create courses, allowed extra sources for the AI.",
  },
  'PATCH /admin/settings': {
    summary: "Update settings",
    description: "Send only what changes.",
  },
  'GET /admin/link-candidates': {
    summary: "Who can be linked",
    description: "Personal accounts using the institution email domain.",
  },
  'POST /admin/link-invitations': {
    summary: "Ask to link",
    description: "Sends the student a request. Nothing changes until they accept.",
  },
  'GET /admin/link-invitations': {
    summary: "Sent link requests",
    description: "status: awaiting-consent, linked or declined.",
  },
  'GET /admin/audit': {
    summary: "Activity log",
    description: "Every change made by the admin team. period: 7d, 30d, 90d or all.",
  },
  'GET /institutions/me': {
    summary: "My institution",
    description: "Name, email domains and settings.",
  },
  'PATCH /institutions/{institutionId}': {
    summary: "Update my institution",
    description: "Name, email domains or settings.",
  },
  'POST /institutions/{institutionId}/units': {
    summary: "Add a unit",
    description: "type: faculty, department, program or semester. Put it under another unit with parentId.",
  },
  'GET /institutions/{institutionId}/units': {
    summary: "List units",
    description: "All units of the institution.",
  },
  'PATCH /units/{unitId}': {
    summary: "Rename or move a unit",
    description: "Change the name or the parent.",
  },
  'DELETE /units/{unitId}': {
    summary: "Delete a unit",
    description: "A unit that still has units under it cannot be deleted.",
  },
  'GET /courses': {
    summary: "List my courses",
    description: "Courses the signed-in user can see.",
  },
  'POST /courses': {
    summary: "Create course",
    description: "Admin: a university course (needs code). Personal student: a private course (no code).",
  },
  'GET /courses/creation-policy': {
    summary: "Can I create courses?",
    description: "Whether the signed-in user is allowed to create courses.",
  },
  'GET /courses/{courseId}': {
    summary: "Course details",
    description: "Course info with its topics.",
  },
  'PATCH /courses/{courseId}': {
    summary: "Update course",
    description: "Title, code or description. Admin or course staff.",
  },
  'GET /courses/catalog': {
    summary: "Browse university courses",
    description: "Courses of my university I can join or request.",
  },
  'POST /courses/{courseId}/catalog-enroll': {
    summary: "Join a course of my year",
    description: "Joins directly. Courses from another year need a join request instead.",
  },
  'POST /courses/{courseId}/enrollment-request': {
    summary: "Request to join",
    description: "For courses outside my study year. The admin approves or rejects it.",
  },
  'GET /courses/enrollment-requests/my': {
    summary: "My join requests",
    description: "Requests I sent and their status.",
  },
  'GET /courses/enrollment-requests': {
    summary: "Join requests (admin)",
    description: "All requests of the institution.",
  },
  'POST /courses/enrollment-requests/{requestId}/decision': {
    summary: "Decide a join request (admin)",
    description: "Same as the admin area decision.",
  },
  'POST /courses/{courseId}/enroll': {
    summary: "Enroll in a course",
    description: "A student enrolls themselves (empty body), or the admin enrolls a student (studentId).",
  },
  'GET /courses/{courseId}/enrollments': {
    summary: "List students",
    description: "Students in the course. Admin and instructors.",
  },
  'DELETE /courses/{courseId}/enroll/{studentId}': {
    summary: "Remove a student",
    description: "Admin only.",
  },
  'POST /courses/{courseId}/staff': {
    summary: "Add teaching staff",
    description: "role: instructor or teaching_assistant. The lecturer gets an email. Admin only.",
  },
  'DELETE /courses/{courseId}/staff/{userId}': {
    summary: "Remove teaching staff",
    description: "Admin only.",
  },
  'POST /courses/{courseId}/topics/detect': {
    summary: "Find topics again",
    description: "Runs topic detection on files that were not processed yet. Normally it runs by itself after each upload.",
  },
  'POST /courses/{courseId}/topics': {
    summary: "Add topic",
    description: "Adds a topic by hand.",
  },
  'PATCH /courses/{courseId}/topics/{topicId}': {
    summary: "Rename topic",
    description: "Change title or order.",
  },
  'POST /courses/{courseId}/topics/merge': {
    summary: "Merge two topics",
    description: "Moves everything from the added topic into topicId, then removes the added topic.",
  },
  'DELETE /courses/{courseId}/topics/{topicId}': {
    summary: "Delete topic",
    description: "Removes the topic.",
  },
  'POST /courses/{courseId}/materials': {
    summary: "Add text material",
    description: "Adds material as plain text. It is ready for the AI within seconds.",
  },
  'POST /courses/{courseId}/materials/file': {
    summary: "Upload a file",
    description: "Upload a PDF, Word, PowerPoint or text file (form-data, field name file).",
  },
  'GET /courses/{courseId}/materials': {
    summary: "List files",
    description: "Course files and whether each is ready.",
  },
  'GET /courses/{courseId}/materials/{materialId}': {
    summary: "File details",
    description: "One file and its status.",
  },
  'GET /courses/{courseId}/materials/{materialId}/file': {
    summary: "Download file",
    description: "The original uploaded file.",
  },
  'PATCH /courses/{courseId}/materials/{materialId}': {
    summary: "Rename file",
    description: "Change the title or the source type.",
  },
  'GET /courses/{courseId}/materials/{materialId}/chunks': {
    summary: "File sections",
    description: "The file split into the small sections the AI reads and cites.",
  },
  'DELETE /courses/{courseId}/materials/{materialId}': {
    summary: "Delete file",
    description: "The AI stops using it immediately.",
  },
  'GET /courses/{courseId}/learner-profile': {
    summary: "My course profile",
    description: "Created the first time it is opened.",
  },
  'POST /courses/{courseId}/diagnostics': {
    summary: "Start the test",
    description: "Leave out topicIds to cover the whole course.",
  },
  'GET /courses/{courseId}/diagnostics': {
    summary: "My past tests",
    description: "Earlier attempts, newest first.",
  },
  'GET /courses/{courseId}/diagnostics/{diagnosticId}': {
    summary: "Get the test",
    description: "Questions, my answers and feedback.",
  },
  'POST /courses/{courseId}/diagnostics/{diagnosticId}/answers': {
    summary: "Answer a question",
    description: "responseMode text (content), voice (audioBase64) or idk (\"I don't know\"). The AI marks it correct, partly correct or wrong and explains why.",
  },
  'GET /courses/{courseId}/diagnostics/{diagnosticId}/evidence': {
    summary: "Test results per topic",
    description: "What the test showed for each topic.",
  },
  'GET /courses/{courseId}/learner-model': {
    summary: "Progress in this course",
    description: "Level per topic, weak points and the suggested next step.",
  },
  'GET /students/me/learning': {
    summary: "My learning overview",
    description: "Across courses: strengths, weak points, study plan and topics due for review. Works even when the AI service is down.",
  },
  'POST /students/me/learning/review': {
    summary: "Record a review answer",
    description: "Did I remember this topic? Used to schedule the next review.",
  },
  'GET /students/me/ai-preferences': {
    summary: "My AI preferences",
    description: "The language the AI answers in, and my learning style.",
  },
  'PATCH /students/me/ai-preferences': {
    summary: "Update AI preferences",
    description: "preferredLanguage: en, ar, fr, sw, ha, am, so, yo, ig or zu.",
  },
  'GET /students/me/ai-health': {
    summary: "Is the AI service up?",
    description: "If it is down, everything keeps working with the built-in backup.",
  },
  'POST /courses/{courseId}/tutor/sessions': {
    summary: "Start a chat",
    description: "mode: explanation, worked_example, summary, revision, coding_help, guided_questioning or practice.",
  },
  'GET /courses/{courseId}/tutor/sessions': {
    summary: "My chats",
    description: "Newest first.",
  },
  'GET /courses/{courseId}/tutor/sessions/{tutorSessionId}': {
    summary: "Open a chat",
    description: "All messages with their sources.",
  },
  'POST /courses/{courseId}/tutor/sessions/{tutorSessionId}/messages': {
    summary: "Ask a question",
    description: "The tutor answers in the language chosen in AI preferences.",
  },
  'PATCH /courses/{courseId}/tutor/sessions/{tutorSessionId}': {
    summary: "Rename chat",
    description: "Send null to go back to the automatic title.",
  },
  'DELETE /courses/{courseId}/tutor/sessions/{tutorSessionId}': {
    summary: "Delete chat",
    description: "Removes the chat.",
  },
  'POST /courses/{courseId}/learning-resources': {
    summary: "Create study material",
    description: "Give a topic, a course file (materialId), or both, and choose up to 10 kinds.",
  },
  'GET /courses/{courseId}/learning-resources': {
    summary: "My study material",
    description: "Only what I created. Instructor and student material are never mixed.",
  },
  'GET /learning-resources/{resourceId}/file': {
    summary: "Download diagram or slides",
    description: "The SVG diagram or PowerPoint file.",
  },
  'DELETE /learning-resources/{resourceId}': {
    summary: "Delete study material",
    description: "Removes one item.",
  },
  'POST /courses/{courseId}/practice/sessions': {
    summary: "Start practice",
    description: "1 to 5 questions on a topic.",
  },
  'GET /courses/{courseId}/practice/sessions': {
    summary: "My practice sessions",
    description: "Newest first.",
  },
  'GET /courses/{courseId}/practice/sessions/{practiceSessionId}': {
    summary: "Open practice",
    description: "Questions, answers and feedback.",
  },
  'POST /courses/{courseId}/practice/sessions/{practiceSessionId}/answers': {
    summary: "Answer",
    description: "Marked right away. Progress updates immediately.",
  },
  'POST /courses/{courseId}/reassessments': {
    summary: "Start",
    description: "Only for topics already tested once.",
  },
  'GET /courses/{courseId}/reassessments': {
    summary: "My attempts",
    description: "Newest first.",
  },
  'GET /courses/{courseId}/reassessments/{reassessmentId}': {
    summary: "Open attempt",
    description: "Questions, answers and the level before starting.",
  },
  'POST /courses/{courseId}/reassessments/{reassessmentId}/answers': {
    summary: "Answer",
    description: "Answers one question.",
  },
  'GET /courses/{courseId}/learning-gain': {
    summary: "Improvement report",
    description: "Before and after, per topic.",
  },
  'POST /sanad/chat': {
    summary: "Talk to Plany",
    description: "Send a message. Plany understands what you need (a plan, what to do today, your progress) and suggests the next action.",
  },
  'GET /sanad/overview': {
    summary: "My courses and plans",
    description: "Everything the Plany home needs.",
  },
  'POST /sanad/plans': {
    summary: "Make a study plan",
    description: "Plany reads your level in each topic and builds a day-by-day plan to the exam.",
  },
  'GET /sanad/plans': {
    summary: "My plans",
    description: "Active and finished plans, with the next task of each.",
  },
  'GET /sanad/plans/{planId}': {
    summary: "Open a plan",
    description: "Days, tasks, what changed and why, and progress per topic.",
  },
  'POST /sanad/plans/{planId}/tasks/{taskId}/start': {
    summary: "Start a task",
    description: "Learn tasks return a lesson. Other tasks create practice or progress-check questions (answer them with the Practice or Measure Progress requests, using the returned refId).",
  },
  'POST /sanad/plans/{planId}/tasks/{taskId}/complete': {
    summary: "Finish a task",
    description: "Plany looks at your result and adapts the rest of the plan. For learn tasks you can send feeling: clear or confused.",
  },
  'POST /sanad/plans/{planId}/tasks/{taskId}/skip': {
    summary: "Skip a task",
    description: "Marks the task as skipped.",
  },
  'POST /sanad/plans/{planId}/replan': {
    summary: "Rearrange after missed days",
    description: "Moves unfinished work forward and keeps each day within your time.",
  },
  'DELETE /sanad/plans/{planId}': {
    summary: "Stop a plan",
    description: "Archives the plan.",
  },
  'GET /sanad/reminders': {
    summary: "My study reminder settings",
    description: "Whether Plany emails you a daily study reminder, and at what time (HH:MM in your timezone, e.g. 21:30).",
  },
  'PATCH /sanad/reminders': {
    summary: "Change study reminders",
    description: "Turn the daily reminder email on or off, or change its time. Send only what you want to change.",
  },
  'POST /sanad/reminders/test': {
    summary: "Send me a reminder now",
    description: "Sends today's reminder right away so you can see it. Nothing is sent when you have no active plan or nothing is due.",
  },
  'POST /sanad/reminders/unsubscribe': {
    summary: "Stop reminders from the email link",
    description: "Used by the \"Stop reminders\" link in the email. Works without logging in.",
  },
  'POST /courses/{courseId}/assignments': {
    summary: "Create assignment",
    description: "Starts as a draft that students cannot see.",
  },
  'GET /courses/{courseId}/assignments': {
    summary: "List assignments",
    description: "status: DRAFT, OPEN or CLOSED (optional).",
  },
  'GET /assignments/{assignmentId}': {
    summary: "Assignment details",
    description: "Instructors see model answers; students do not.",
  },
  'PATCH /assignments/{assignmentId}': {
    summary: "Rename assignment",
    description: "Change the title.",
  },
  'POST /assignments/{assignmentId}/questions': {
    summary: "Add question",
    description: "Adding a model answer or marking guide makes AI marking more reliable.",
  },
  'PATCH /assignments/{assignmentId}/questions/{questionId}': {
    summary: "Edit question",
    description: "Send only what changes.",
  },
  'DELETE /assignments/{assignmentId}/questions/{questionId}': {
    summary: "Delete question",
    description: "Removes a question (here: the second one).",
  },
  'POST /assignments/{assignmentId}/publish': {
    summary: "Publish",
    description: "Students can now see and answer it. Needs at least one question.",
  },
  'POST /assignments/{assignmentId}/close': {
    summary: "Close",
    description: "Students can no longer answer.",
  },
  'POST /assignments/{assignmentId}/open': {
    summary: "Reopen",
    description: "Opens a closed assignment again.",
  },
  'PATCH /assignments/{assignmentId}/grade-visibility': {
    summary: "Show or hide grades",
    description: "Students see their grades only when this is on.",
  },
  'PATCH /assignments/{assignmentId}/feedback-visibility': {
    summary: "Show or hide feedback",
    description: "Students see written feedback only when this is on.",
  },
  'PUT /assignments/{assignmentId}/answers/{questionId}': {
    summary: "Save answer",
    description: "Can be changed until submitting.",
  },
  'POST /assignments/{assignmentId}/submit': {
    summary: "Submit",
    description: "Sends all answers. The AI marks them in the background.",
  },
  'GET /assignments/{assignmentId}/result': {
    summary: "My result",
    description: "Shown once the instructor approved the grade and made it visible.",
  },
  'POST /assignments/{assignmentId}/questions/{questionId}/preview-evaluation': {
    summary: "Try the AI marking",
    description: "Check how the AI would mark an answer. Nothing is saved.",
  },
  'GET /assignments/{assignmentId}/review': {
    summary: "Submissions to review",
    description: "Grouped into ready to approve, needs a look, and done.",
  },
  'GET /submissions/{submissionId}': {
    summary: "Open a submission",
    description: "Answers with the AI suggested marks and reasons.",
  },
  'GET /assignments/{assignmentId}/common-mistakes': {
    summary: "Common mistakes",
    description: "Mistakes many students made, most common first.",
  },
  'POST /submissions/{submissionId}/approve': {
    summary: "Approve AI grade",
    description: "Accepts the AI suggested grade as final.",
  },
  'POST /submissions/{submissionId}/edit': {
    summary: "Change the grade",
    description: "Set your own score and feedback. The AI suggestion is kept for reference.",
  },
  'POST /submissions/{submissionId}/reject': {
    summary: "Grade by hand",
    description: "Ignore the AI suggestion and grade yourself.",
  },
  'POST /submissions/{submissionId}/request-resubmission': {
    summary: "Ask to resubmit",
    description: "The student sees your reason and can answer again. A reason is required.",
  },
  'POST /assignments/{assignmentId}/bulk-approve': {
    summary: "Approve many at once",
    description: "Only submissions the AI marked with high confidence. If one is not eligible, none are approved.",
  },
  'POST /courses/{courseId}/remedial': {
    summary: "Create extra help material",
    description: "The AI drafts material for a topic (origin STANDALONE, topicId) or for a common mistake (origin FROM_MISCONCEPTION, assignmentId and misconceptionCode). It stays a draft until published.",
  },
  'GET /courses/{courseId}/remedial': {
    summary: "List (instructor)",
    description: "status: DRAFT or PUBLISHED (optional).",
  },
  'GET /courses/{courseId}/remedial/{remedialId}': {
    summary: "Open (instructor)",
    description: "One item with all its details.",
  },
  'PATCH /courses/{courseId}/remedial/{remedialId}': {
    summary: "Edit draft",
    description: "Change title or text. Published items cannot be edited.",
  },
  'POST /courses/{courseId}/remedial/{remedialId}/publish': {
    summary: "Publish",
    description: "audienceType: ALL_STUDENTS, SELECTED_STUDENTS (with studentIds), or AFFECTED_STUDENTS (only for material made from a common mistake).",
  },
  'GET /courses/{courseId}/remedial/mine': {
    summary: "My extra material (student)",
    description: "Material the instructor sent to me.",
  },
  'GET /instructor/home': {
    summary: "My courses overview",
    description: "For each course I teach: submissions waiting for review, ready to approve and done.",
  },
  'GET /courses/{courseId}/analytics': {
    summary: "Course report",
    description: "Grades and results per topic.",
  },
  'GET /courses/{courseId}/coverage-gaps': {
    summary: "Topics without questions",
    description: "Topics that no assignment question covers yet.",
  },
  'GET /courses/{courseId}/audit-log': {
    summary: "Grading history",
    description: "Every approve, edit, reject and resubmission request, with the original AI grade.",
  },
};

export function applyRouteTexts(spec) {
  for (const [key, text] of Object.entries(ROUTE_TEXTS)) {
    const [method, path] = key.split(' ');
    const operation = spec.paths?.[path]?.[method.toLowerCase()];
    if (operation) Object.assign(operation, text);
  }
  return spec;
}
