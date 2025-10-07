# Implementation Plan: Message Edit & Delete

## 1. Objective
Implement the ability for users to edit and delete their own messages. Server owners should also have the ability to delete any message in their server.

## 2. User Interface & Experience
- **Controls**: On hovering a message, action icons (Edit, Delete) will appear.
- **Permissions**:
  - Users will only see "Edit" and "Delete" on their own messages.
  - Server owners/admins will see a "Delete" icon on all messages.
- **Editing Flow**:
  1. Clicking "Edit" transforms the message into an input field.
  2. The user can modify the text.
  3. Pressing `Enter` saves the changes. Pressing `Escape` cancels the edit.
  4. An `(edited)` indicator will appear next to the timestamp of modified messages.
- **Deletion Flow**:
  1. Clicking "Delete" will trigger a confirmation modal to prevent accidental deletion.
  2. Confirming the action will permanently remove the message from the chat.

## 3. Data Model Changes
The documents within the `messages` subcollection will be updated to include:
- `updatedAt` (Timestamp): To track when a message was last edited.
- `isEdited` (Boolean): A flag to easily identify edited messages in the UI.

## 4. Firestore Security Rules
The rules for the `messages` subcollection will be updated to enforce the correct permissions:
- **Update**: Allowed only if the requesting user's ID matches the message's `senderId`.
- **Delete**: Allowed if the requesting user is the message's `senderId` OR if the user is the server owner.

## 5. Files to Modify
- `src/components/chat/ChatWindow.jsx`: To implement the UI and client-side logic for editing and deleting messages.
- `firestore.rules`: To update the security rules for the `messages` subcollection.
