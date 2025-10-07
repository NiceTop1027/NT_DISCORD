# Task List: Message Edit & Delete

This file outlines the tasks required to implement the message edit and delete feature.

---

### Phase 1: Security & Data Model

- [X] **Task 1.1**: Update `firestore.rules` to allow users to update their own messages and delete their own messages. Also, allow server owners to delete any message.
- [X] **Task 1.2**: Modify the message sending logic to include `isEdited: false` and `updatedAt: null` when a new message is created.

### Phase 2: Core Implementation (UI)

- [X] **Task 2.1**: Modify `src/components/chat/ChatWindow.jsx` to display "Edit" and "Delete" buttons on message hover, based on user permissions.
- [X] **Task 2.2**: Implement the message editing UI in `ChatWindow.jsx`. This includes turning the message into an input field and handling the save/cancel actions.
- [X] **Task 2.3**: Implement the `updateDoc` call in `ChatWindow.jsx` to save the edited message content to Firestore, setting `isEdited` to `true` and updating `updatedAt`.
- [X] **Task 2.4**: Implement the message deletion confirmation modal and the `deleteDoc` call in `ChatWindow.jsx`.
- [X] **Task 2.5**: Add the `(edited)` indicator to messages where `isEdited` is true.

---

# Task List: Member Profile Pop-up

This file outlines the tasks required to implement the Discord-like member profile pop-up feature.

---

### Phase 1: Data Model & Permissions (Review/Refine)
- [X] **Task 1.1**: Review `data-model.md` for `User` and `ServerMember` schemas to ensure all necessary fields for profile display and editing are present.
- [X] **Task 1.2**: Review `firestore.rules` to ensure appropriate read access for user profiles and write access for user settings and nickname changes (admin).

### Phase 2: UI Components
- [X] **Task 2.1**: Create a new React component `UserProfileModal.jsx` (or similar) for the profile pop-up.
- [X] **Task 2.2**: Implement basic display of user information (display name, avatar, bio, status) within `UserProfileModal.jsx`.
- [X] **Task 2.3**: Integrate `UserProfileModal.jsx` to open when a member is clicked in `UserList.jsx`.

### Phase 3: User Settings & Interactions
- [X] **Task 3.1**: Add UI elements within `UserProfileModal.jsx` for the user to edit their own profile (e.g., bio, status).
- [X] **Task 3.2**: Implement logic to update the user's own profile in Firestore when changes are saved.

### Phase 4: Admin Functionality (Nickname Management)
- [X] **Task 4.1**: Add UI elements within `UserProfileModal.jsx` for server owners/admins to change a member's nickname. This should only be visible to users with `MANAGE_NICKNAMES` permission.
- [X] **Task 4.2**: Implement logic to update the `nickname` field in the `ServerMember` array within the `Server` document in Firestore.
- [X] **Task 4.3**: Implement permission checks to ensure only authorized users can perform nickname changes.

### Phase 5: State Management & Real-time Updates
- [X] **Task 5.1**: Integrate `UserProfileModal.jsx` with Zustand to manage its open/close state and the data it displays.
- [X] **Task 5.2**: Ensure real-time updates for user profiles and nicknames are reflected in the UI.

### Phase 6: Testing
- [X] **Task 6.1**: Write unit tests for `UserProfileModal.jsx` and related logic.
- [X] **Task 6.2**: Write integration tests for Firestore interactions (updating user profiles, changing nicknames).
- [X] **Task 6.3**: Add E2E tests using Playwright for the full user flow (opening profile, editing own profile, admin changing nickname).

---

# Task List: Admin Channel/Category Management

This file outlines the tasks required to implement administrator functionality to add, delete, and manage categories and channels.

---

### Phase 1: Data Model & Permissions (Review/Refine)
- [X] **Task 1.1**: Review `data-model.md` for `Channel` and `Server` schemas. Determine how categories will be represented (e.g., a `category` field in `Channel` documents, or a separate `categories` subcollection).
- [X] **Task 1.2**: Review `firestore.rules` to ensure appropriate write access for creating/deleting/updating `Channel` documents, restricted to users with `MANAGE_CHANNELS` or `ADMINISTRATOR` permissions.

### Phase 2: UI Components (Create/Delete Channel)
- [X] **Task 2.1**: Modify `src/components/channel/ChannelList.jsx` to display "Create Channel" buttons (for text and voice) only to users with `MANAGE_CHANNELS` permission.
- [X] **Task 2.2**: Implement a modal/form for creating new channels (`CreateChannelModal.jsx` already exists, will need to be updated). This modal should allow specifying channel `name`, `type` (`text` or `voice`), and potentially a `category`.
- [X] **Task 2.3**: Implement logic to add new `channel` documents to Firestore.
- [X] **Task 2.4**: Modify `src/components/channel/ChannelList.jsx` to display a "Delete Channel" option (e.g., on hover or context menu) only to users with `MANAGE_CHANNELS` permission.
- [X] **Task 2.5**: Implement logic to delete `channel` documents from Firestore.

### Phase 3: UI Components (Category Management)
- [X] **Task 3.1**: Determine how categories will be displayed in `src/components/channel/ChannelList.jsx` (e.g., as collapsible headers).
- [X] **Task 3.2**: Add UI elements for admins to create/delete/rename categories (e.g., buttons next to category headers, or a dedicated modal).
- [X] **Task 3.3**: Implement logic to manage categories in Firestore (e.g., updating `category` field in `Channel` documents, or managing a `categories` collection).

### Phase 4: State Management & Real-time Updates
- [X] **Task 4.1**: Ensure `useStore` correctly manages and provides channel and category data, including real-time updates.
- [X] **Task 4.2**: Update `useStore` actions for creating/deleting/updating channels and categories.

### Phase 5: Testing
- [X] **Task 5.1**: Write unit tests for new/modified components and logic.
- [X] **Task 5.2**: Write integration tests for Firestore interactions (creating/deleting channels/categories).
- [X] **Task 5.3**: Add E2E tests using Playwright for admin channel/category management flows.