# MineText Spaces

A web application for creating personalized "Spaces" where users can share content with their community. Each Space has a unique name for public access and an admin password for content management.

## Features

- 🌌 **Create Personalized Spaces** - Set unique space names and admin passwords
- 👀 **Public Content Viewing** - Anyone with the space name can view content
- 🔒 **Admin-Only Content Management** - Secure password-protected content creation
- 📸 **Image Upload Support** - Upload up to 6 images per post (5MB each)
- 🎨 **Modern UI** - Responsive design with smooth animations
- 🛡️ **Security Features** - Rate limiting, input validation, XSS protection

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas (via Mongoose)
- **Authentication**: JWT + bcrypt
- **File Upload**: Multer
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account
- Modern web browser

## Quick Start

### 1. Install Dependencies

```powershell
npm install
```

### 2. Set Up MongoDB Atlas

1. Create a MongoDB Atlas account at https://cloud.mongodb.com/
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string

### 3. Configure Environment

Copy `.env.example` to `.env` and update:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=3000
NODE_ENV=development
UPLOAD_DIR=./uploads
```

### 4. Run the Application

```powershell
npm start
```

Or for development with auto-reload:

```powershell
npm run dev
```

### 5. Open in Browser

Visit: http://localhost:3000

## API Endpoints

### Spaces
- `POST /api/spaces` - Create a new space
- `GET /api/spaces/:spaceName` - Get space content (public)
- `POST /api/spaces/:spaceName/login` - Admin login

### Content Management (Admin Only)
- `POST /api/spaces/:spaceName/content` - Add content with optional images
- `PUT /api/spaces/:spaceName/content/:id` - Update content
- `DELETE /api/spaces/:spaceName/content/:id` - Delete content

### File Serving
- `GET /uploads/:filename` - Serve uploaded images

## Database Schema

### Spaces Collection
```javascript
{
  name: String (unique, 3-40 chars, alphanumeric + hyphens/underscores),
  passwordHash: String (bcrypt hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Contents Collection
```javascript
{
  spaceId: ObjectId (ref to Spaces),
  text: String (max 5000 chars),
  images: [{
    filename: String,
    originalName: String, 
    storedName: String,
    mimeType: String,
    size: Number
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Security Features

- **Password Hashing**: bcrypt with 12 rounds
- **JWT Authentication**: 1-hour expiry tokens
- **Rate Limiting**: 100 requests/15min general, 5 auth attempts/15min
- **File Validation**: Image-only uploads, 5MB limit per file
- **Input Sanitization**: XSS protection via HTML escaping
- **CORS**: Configurable origin restrictions

## File Upload Limits

- **File Types**: JPEG, PNG, WebP, GIF
- **File Size**: 5MB per file
- **Files per Post**: Maximum 6 images
- **Storage**: Local filesystem (configurable to cloud storage)

## Development Notes

### Project Structure
```
├── models/
│   ├── Space.js      # Space model/schema
│   └── Content.js    # Content model/schema
├── uploads/          # File upload directory (auto-created)
├── server.js         # Main Express server
├── index.html        # Frontend HTML
├── script.js         # Frontend JavaScript
├── style.css         # Frontend styles
├── package.json      # Dependencies
└── .env.example      # Environment template
```

### Adding New Features

The codebase is structured for easy expansion:

1. **New API endpoints**: Add to `server.js` with proper authentication
2. **Database changes**: Update Mongoose models in `models/`
3. **Frontend features**: Extend `script.js` with new handlers
4. **UI components**: Add to `index.html` and style in `style.css`

## Production Deployment

### Security Checklist
- [ ] Use strong JWT_SECRET (32+ random characters)
- [ ] Enable HTTPS
- [ ] Configure CORS for your domain
- [ ] Set up proper MongoDB Atlas network access
- [ ] Use environment variables for all secrets
- [ ] Enable MongoDB Atlas monitoring
- [ ] Set up proper logging and error monitoring
- [ ] Configure file upload to cloud storage (S3, Cloudinary)

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=<your-production-mongodb-uri>
JWT_SECRET=<strong-random-secret>
PORT=443
UPLOAD_DIR=/app/uploads
```

### Deployment Platforms
- **Heroku**: Easy deployment with MongoDB Atlas addon
- **Vercel**: Frontend + serverless functions
- **DigitalOcean**: Full control VPS deployment
- **Railway**: Modern deployment platform

## Future Enhancements

- Content expiry dates
- Comment system
- Content categories/tags
- Advanced image processing (thumbnails, compression)
- Real-time updates via WebSocket
- Content search functionality
- User analytics dashboard
- Content export/import
- Multi-admin support
- Custom themes per space

## Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Verify connection string format
- Check network access in MongoDB Atlas
- Ensure database user has proper permissions

**File Upload Not Working**
- Check upload directory permissions
- Verify file size and type restrictions
- Ensure multer middleware is properly configured

**Frontend Not Loading**
- Check if server is running on correct port
- Verify static file serving is enabled
- Check browser console for JavaScript errors

### Support

For issues and questions:
1. Check the browser console for errors
2. Review server logs for backend issues
3. Verify MongoDB Atlas connectivity
4. Test API endpoints with tools like Postman

## License

MIT License - feel free to use this project as a starting point for your own applications.