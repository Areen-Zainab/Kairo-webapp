# 💼 Kairo Frontend — Intelligent Meeting Companion  

Kairo is an **AI-powered meeting intelligence platform** that captures, transcribes, and analyzes meetings to provide **summaries, speaker insights, contextual recall, and actionable knowledge** — all while ensuring **enterprise-grade security**.  

This repository contains the **Kairo frontend**, built using **React**, **TypeScript**, and **TailwindCSS v3**.  
It provides the user-facing interface for managing meetings, visualizing knowledge, and interacting with the Kairo assistant.  

---

## 🗁 Project Structure  

```
root/
│
├── frontend/              # React frontend source for Kairo
│   ├── src/               # Application source code (components, hooks, views)
│   ├── public/            # Static assets (icons, logos, manifest)
│   ├── package.json       # Frontend dependencies
│   ├── tailwind.config.js # Tailwind configuration
│   ├── tsconfig.json      # TypeScript configuration
│   └── postcss.config.js  # PostCSS configuration
│
└── README.md              # Project documentation (this file)
```

---

## ⚙️ Prerequisites  

Before setting up, ensure you have the following installed:  

* **Node.js** (v18 or higher)  
* **npm** (v9 or higher) or **yarn** (optional)  

Verify installation:  

```bash
node -v
npm -v
```

If you don’t have Node.js installed, get it from [nodejs.org](https://nodejs.org/).  

---

## 🧩 Setup Instructions  

### 1. Clone the repository  

```bash
git clone https://github.com/Areen-Zainab/Kairo-webapp
cd Kairo-webapp/frontend
```

---

### 2. Install dependencies  

Using **npm**:  

```bash
npm install
```

Or using **yarn**:  

```bash
yarn install
```

This installs all frontend dependencies (React, TailwindCSS, TypeScript, Vite, etc.).  

---

### 3. Run the development server  

Start Kairo’s frontend in development mode:  

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.  

---

### 4. Build for production  

To create an optimized production build:  

```bash
npm run build
```

The build output will appear in the `dist/` directory.  

Preview it locally:  

```bash
npm run preview
```

---

## 🎨 Styling with TailwindCSS  

TailwindCSS is already set up. You can use its utility classes directly:  

```tsx
export default function Button() {
  return (
    <button className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
      Join Meeting
    </button>
  );
}
```

If you update `tailwind.config.js`, restart your dev server to apply changes.  

---

## 🧱 TypeScript  

Kairo’s frontend uses **TypeScript** for reliability and maintainability.  
Type safety is enforced during builds and development.  

---

## 🧰 Common Commands  

| Command           | Description                             |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Start the development server            |
| `npm run build`   | Build for production                    |
| `npm run preview` | Preview production build                |
| `npm run lint`    | Run ESLint for code quality checks      |

---

## 👥 Collaborator Setup  

For any new contributor to **Kairo**:  

1. Clone the repository.  
2. Navigate to the `frontend/` directory.  
3. Run `npm install`.  
4. Start the app using `npm run dev`.  
5. Begin contributing to Kairo’s interface and user experience.  

No manual configuration needed — everything is pre-setup.  

---

## 🧹 .gitignore  

Ignored by default:  

```
node_modules/
dist/
.env
```

Ensure you **never commit environment variables or build outputs.**.  

---

## 💡 About Kairo  

Kairo provides a unified interface for:  
- Real-time meeting transcription and speaker diarization.  
- AI-based summarization and action item extraction.  
- Task and project contextual recall.  
- Speaker-based search and insight visualization.  
- Interactive knowledge graph visualization.  

This frontend integrates these features into an intuitive, workspace-centric UI.  

---

## 🧑‍💻 Contributing  

To contribute a new feature or fix:  

```bash
git checkout -b feature/your-feature-name
```

After making changes:  

```bash
git commit -m "Add: contextual recall sidebar component"
git push origin feature/your-feature-name
```

Then open a Pull Request.  

---

## 🧾 License  

Kairo is currently under **internal development**.  
A license (e.g., MIT, Apache 2.0) will be added before public release.  

---

## 💬 Support  

If you encounter issues during setup:  
- Verify Node.js version compatibility.  
- Delete `node_modules` and `package-lock.json`, then reinstall.  
- Contact the **Kairo Dev-Team** for assistance.  

---

*Developed with love by the Kairo Team <3* 
