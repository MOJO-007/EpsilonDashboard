
# Epsilon Social Media Dashboard

This project is a **full-stack Node.js application** that connects to various social media platforms ** (YouTube only for this prototype) ** to fetch videos, comments, and any such activity to perform **sentiment analysis using Gemini API**, and auto-replies to comments. It features a modern **TailwindCSS-based dashboard** with authentication and analytics.

---

## 🚀 Features

✅ OAuth 2.0 YouTube authentication (via Passport.js)  
✅ Fetches videos, comments, and basic analytics from your channel  
✅ Gemini-powered sentiment analysis on comments  
✅ Auto-reply to positive comments  
✅ Manual monitor trigger for new activities  
✅ Dynamic analytics for sentiment trends  
✅ Modular architecture for easy maintenance  

---

## 🛠️ Tech Stack

| Layer | Technology |
|--------|------------|
| Backend | Node.js, Express.js |
| Frontend | JavaScript (ES6+), TailwindCSS |
| APIs | YouTube Data API v3, Google Gemini API |
| Auth | Passport.js (YouTube OAuth) |
| DB | MongoDB Atlas Cluster |
| HTTP client | Axios |

---

## 🖥️ Screenshots
![WhatsApp Image 2025-07-07 at 09 12 39](https://github.com/user-attachments/assets/0140893a-a675-46b6-b05a-f156e311dd7f)
![WhatsApp Image 2025-07-06 at 22 37 53](https://github.com/user-attachments/assets/76bf61fc-85e0-415f-92de-3907253b215d)
![WhatsApp Image 2025-07-06 at 22 38 13](https://github.com/user-attachments/assets/215e688d-1578-44a3-94d5-50430d2a834e)
![WhatsApp Image 2025-07-06 at 22 38 23](https://github.com/user-attachments/assets/be5c86bf-580d-4334-b656-b33a2171e5c3)

---

## ⚙️ Installation

### 1️⃣ Clone the repository
> git clone https://github.com/yourusername/your-repo-name.git   
> cd your-repo-name

### 2️⃣ Install dependencies
> npm install

### 3️⃣ Set up environment variables

 > Create a ' .env '  file in the root directory and provide:

#### .env structure
> YOUTUBE_CLIENT_ID=your_youtube_client_id   
> YOUTUBE_CLIENT_SECRET=your_youtube_client_secret   
> YOUTUBE_CALLBACK_URL=http://localhost:3000/auth/youtube/callback (For local development)   
> GEMINI_API_KEY=your_gemini_api_key   
> MONGODB_URI=your_mongodb_atlas_connection_string   
> PORT=3000 (For local development)   
> **Tip:** Don't commit your \`.env\` file to version control!   

### 4️⃣ Run the project
> node server.js

Open your browser and navigate to:
> http://localhost:3000   

---

## 📝 Usage

👉 **Connect your YouTube channel** via the dashboard  
👉 **View analytics** on recent videos, views, likes, comments  
👉 **Trigger sentiment analysis** manually or enable auto-reply  
👉 **Monitor comment sentiment trends over time**

---

## 🗂️ Project Structure
.   
├── server.js              # App entry point   
├── /routes                # Express routers (auth, dashboard, api)   
├── /services              # YouTube, Gemini, sentiment services   
├── /models                # Mongoose models   
├── /public                # Static assets (CSS, JS)   
├── /views                 # HTML templates or frontend files   
└── README.md              # You're reading this!   

---

## 🌐 API Usage

- **YouTube Data API v3** → Fetch channel, videos, comments  
- **Gemini API** → Sentiment analysis with confidence scoring  

---

## 🧑‍🤝‍🧑 Contributing

✅ Fork the repo  
✅ Create your feature branch: \`git checkout -b feature/my-feature\`  
✅ Commit your changes: \`git commit -m 'Add some feature'\`  
✅ Push to the branch: \`git push origin feature/my-feature\`  
✅ Open a pull request  

---

## 📃 License

This project is licensed under the MIT License.
