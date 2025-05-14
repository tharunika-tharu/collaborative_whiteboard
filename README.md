# Collaborative Whiteboard

## Overview

A real-time, multi-user drawing application that allows multiple participants to draw simultaneously on a shared canvas.

## Table of Contents

- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Configuration](#configuration)
- [Features](#features)
- [API Documentation](#api-documentation)

---

## Project Structure

```plaintext
collaborative_whiteboard/
├── client/                  # Frontend code
│   ├── public/              # Static assets
│   ├── src/                 # React application source
│   │   ├── components/      # Reusable components
│   │   ├── App.js           # Main application component
│   │   ├── index.js         # Entry point
│   │   └── index.html
│   └── package.json         # Frontend dependencies
├── server/                  # Backend code
│   ├── .gitignore           
│   ├── index.js             # main application setup
│   └── package.json         # Backend dependencies
└── README.md                # Project overview
```

--- 

## Technologies Used

**Frontend:**

- React: JavaScript library for building user interfaces
- Socket.IO Client: For real-time communication with the server
- Canvas API: For drawing operations
- Material-UI: For UI components and styling
- Redux: For state management (optional, depending on project complexity)

**Backend:**

- Node.js: JavaScript runtime environment
- Express: Web application framework
- Socket.IO: For real-time bidirectional communication
- MongoDB: NoSQL database for storing whiteboard data
- Mongoose: MongoDB object modeling for Node.js

---

## Installation

**Prerequisites**
- Node.js
- MongoDB 

**Steps**

1. Clone the repository
```bash

git clone https://github.com/tharunika-tharu/collaborative_whiteboard.git
cd  collaborative_whiteboard 
```
2. Install backend dependencies
```bash

cd server
npm install
```
3. Install frontend dependencies
```bash

cd ../client
npm install
```
4. Install frontend dependencies
```bash

PORT=5000
MONGODB_URI=mongodb://localhost:27017/whiteboard
CORS_ORIGIN=http://localhost:3000
```
3. Start the development servers
- In one terminal(backend):
```bash

cd server
npm run dev
```
- In another terminal(frontend):
```bash

cd client
npm start
```

---

## Configuration

**Environment Variables**

<table>
    <thead>
        <tr>
            <th>Variable</th>
            <th>Description</th>
            <th>Default Value</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>PORT</td>
            <td>Backend server port</td>
            <td>5000</td>
        </tr>
        <tr>
            <td>MONGODB_URI</td>
            <td>MongoDB connection string</td>
            <td>mongodb://localhost:27017/whiteboard</td>
        </tr>
        <tr>
            <td>CORS_ORIGIN</td>
            <td>Allowed origin for CORS</td>
            <td>http://localhost:3000</td>
        </tr>
        <tr>
            <td>NODE_ENV</td>
            <td>Application environment</td>
            <td>development</td>
        </tr>
    </tbody>
</table>

---

## Features

***Core Features***
1. **Real-time Collaboration:**

- Multiple users can draw simultaneously
- Changes are instantly visible to all participants
- User cursors are displayed for all connected participants

2. **Drawing Tools:**

- Freehand drawing
- Shapes (lines, rectangles, circles)
- Color selection
- Brush size adjustment

3. **Eraser tool**

- Whiteboard Management:
- Create new whiteboards
- Save/load whiteboards
- Share whiteboard links
- Set whiteboard permissions (read-only, edit)

4. **User Authentication:**

- User registration and login
- JWT-based authentication
- Session management

5. **History & Undo/Redo:**

- Track drawing history
- Undo/redo functionality
- Version control

***Advanced Features***

1. **Export/Import:**

- Export whiteboard as PNG/JPEG
- Import images to whiteboard

2. **Text Tool:**

- Add text annotations
- Font customization

3. **Sticky Notes:**

- Add movable sticky notes
- Color coding

4. **User Presence:**

- Display active users
- User activity indicators

---

## API DOCUMENTATION

***REST API Endpoints***

1. **Authentication**
<table>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>POST</td>
            <td>/api/auth/register</td>
            <td>Register a new user</td>
        </tr>
        <tr>
            <td>POST</td>
            <td>/api/auth/login</td>
            <td>Authenticate user</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>/api/auth/me</td>
            <td>Get current user info</td>
        </tr>
    </tbody>
</table>

2. **Whiteboards**
<table>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>POST</td>
            <td>/api/whiteboards</td>
            <td>Create a new whiteboard</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>/api/whiteboards</td>
            <td>List all whiteboards</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>/api/whiteboards/:id</td>
            <td>Get whiteboard details</td>
        </tr>
        <tr>
            <td>PUT</td>
            <td>/api/whiteboards/:id</td>
            <td>Update whiteboard</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>/api/whiteboards/:id</td>
            <td>Delete whiteboard</td>
        </tr>
    </tbody>
</table>

3. **Whiteboard Elements**
<table>
    <thead>
        <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>POST</td>
            <td>/api/whiteboards/:id/elements</td>
            <td>Add element to whiteboard</td>
        </tr>
        <tr>
            <td>GET</td>
            <td>/api/whiteboards/:id/elements</td>
            <td>Get all elements</td>
        </tr>
        <tr>
            <td>PUT</td>
            <td>/api/whiteboards/:id/elements/:elementId</td>
            <td>Update element</td>
        </tr>
        <tr>
            <td>DELETE</td>
            <td>/api/whiteboards/:id/elements/:elementId</td>
            <td>Delete element</td>
        </tr>
    </tbody>
</table>

4. **Socket.IO Events**

<table>
    <thead>
        <tr>
            <th>Event</th>
            <th>Data</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>whiteboard-update</td>
            <td>{ elements: [] }</td>
            <td>Full whiteboard state update</td>
        </tr>
        <tr>
            <td>element-added</td>
            <td>{ element }</td>
            <td>New element added</td>
        </tr>
        <tr>
            <td>element-updated</td>
            <td>{ element }</td>
            <td>Element updated</td>
        </tr>
        <tr>
            <td>element-removed</td>
            <td>{ elementId }</td>
            <td>Element removed</td>
        </tr>
        <tr>
            <td>user-joined</td>
            <td>{ userId, username }</td>
            <td>New user joined</td>
        </tr>
        <tr>
            <td>user-left</td>
            <td>{ userId }</td>
            <td>User left</td>
        </tr>
    </tbody>
</table>

5. **Client Emits**
<table>
    <thead>
        <tr>
            <th>Event</th>
            <th>Data</th>
            <th>Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>join-whiteboard</td>
            <td>{ whiteboardId }</td>
            <td>Join a whiteboard</td>
        </tr>
        <tr>
            <td>leave-whiteboard</td>
            <td>{ whiteboardId }</td>
            <td>Leave a whiteboard</td>
        </tr>
        <tr>
            <td>add-element</td>
            <td>{ element }</td>
            <td>Add new element</td>
        </tr>
        <tr>
            <td>update-element</td>
            <td>{ element }</td>
            <td>Update existing element</td>
        </tr>
        <tr>
            <td>remove-element</td>
            <td>{ elementId }</td>
            <td>Remove element</td>
        </tr>
    </tbody>
</table>
