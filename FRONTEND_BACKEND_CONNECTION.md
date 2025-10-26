# Frontend-Backend Connection Guide

This guide explains how to connect your Kairo frontend and backend for authentication.

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your database URL and JWT secret

# Set up database
npm run setup

# Start the backend
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your API URL (default: http://localhost:5000/api)

# Start the frontend
npm start
```

## 🔧 Configuration

### Backend Environment (.env)
```env
DATABASE_URL="postgresql://username:password@localhost:5432/kairo_db"
JWT_SECRET="your-super-secret-jwt-key-here"
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend Environment (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 📁 New Files Created

### Backend
- `src/lib/prisma.js` - Prisma client configuration
- `src/models/User.js` - User model with business logic
- `src/middleware/auth.js` - JWT authentication middleware
- `src/middleware/validation.js` - Input validation middleware
- `scripts/setup.js` - Database setup script
- `env.example` - Environment variables template

### Frontend
- `src/services/api.ts` - API service for backend communication
- `src/context/AuthContext.tsx` - Authentication context provider
- `src/components/ProtectedRoute.tsx` - Route protection component
- `env.example` - Environment variables template

## 🔄 Updated Files

### Backend
- `prisma/schema.prisma` - Complete database schema
- `src/routes/authRoutes.js` - Enhanced authentication routes
- `src/server.js` - Updated server configuration
- `package.json` - Added Prisma scripts

### Frontend
- `src/App.tsx` - Added AuthProvider and protected routes
- `src/pages/LogIn.tsx` - Real API integration
- `src/pages/SignUp.tsx` - Real API integration
- `src/components/Layout.tsx` - Real user data integration
- `src/components/Navbar.tsx` - Logout functionality

## 🧪 Testing the Connection

### 1. Test Signup
```bash
# Frontend: http://localhost:3000/signup
# Fill out the form and submit
# Should redirect to /onboarding on success
```

### 2. Test Login
```bash
# Frontend: http://localhost:3000/login
# Use the credentials from signup
# Should redirect to /dashboard on success
```

### 3. Test Protected Routes
```bash
# Try accessing http://localhost:3000/dashboard without login
# Should redirect to /login
```

## 🔐 Authentication Flow

1. **Signup**: User creates account → Backend creates user → JWT token returned → User logged in
2. **Login**: User enters credentials → Backend validates → JWT token returned → User logged in
3. **Protected Routes**: Check JWT token → Validate with backend → Allow/deny access
4. **Logout**: Clear JWT token → Redirect to login

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update user profile
- `PUT /api/auth/me/preferences` - Update preferences
- `PUT /api/auth/me/notifications` - Update notification settings
- `GET /api/auth/verify` - Verify JWT token

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend CORS is configured for frontend URL
   - Check FRONTEND_URL in backend .env

2. **Database Connection**
   - Verify DATABASE_URL in backend .env
   - Ensure PostgreSQL is running
   - Run `npm run db:push` to sync schema

3. **JWT Errors**
   - Check JWT_SECRET in backend .env
   - Ensure token is being sent in Authorization header

4. **API Connection**
   - Verify REACT_APP_API_URL in frontend .env
   - Check if backend is running on correct port
   - Test API endpoints directly with Postman/curl

### Debug Steps

1. Check browser console for errors
2. Check backend console for errors
3. Verify environment variables
4. Test API endpoints directly
5. Check network tab for failed requests

## 📝 Sample User

After running `npm run db:seed` in the backend, you can use:
- **Email**: user@example.com
- **Password**: password123

## 🎯 Next Steps

1. **Email Verification**: Add email verification flow
2. **Password Reset**: Implement password reset functionality
3. **Social Login**: Add Google/GitHub OAuth
4. **Two-Factor Auth**: Implement 2FA
5. **Session Management**: Add session timeout and refresh

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [JWT.io](https://jwt.io/) - JWT token debugger
- [React Context API](https://reactjs.org/docs/context.html)
- [React Router](https://reactrouter.com/)

