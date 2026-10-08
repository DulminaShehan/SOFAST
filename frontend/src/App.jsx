import { useState } from 'react';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return <Login />;
}

export default App;
