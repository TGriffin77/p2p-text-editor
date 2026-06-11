import { useState } from 'react'

import './App.css'
import Editor from './components/Editor'
import Preview from './components/Preview'

function App() {
  const [content, setContent] = useState('');

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">My App</h1>
      
      <div className="flex flex-row w-full h-screen">
        <Editor value={content} onChange={setContent} />
        <Preview content={content} />
      </div>
    </>
  )
}

export default App
