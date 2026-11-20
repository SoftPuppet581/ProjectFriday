import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './tokens.css';
import './styles.css';
import './explore.css';
import './news.css';
import './responsive.css';
import './cinema.css';
import './theme.css'; // 항상 마지막: 디자인 토큰을 기존 스타일 위에 적용한다

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
