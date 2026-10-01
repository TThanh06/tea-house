import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { Empty } from './components/ui.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  render(){if(this.state.error)return <main><Empty title="Có lỗi hiển thị"><p>Hãy tải lại trang. Nếu giỏ hàng cũ không hợp lệ, bạn có thể xóa giỏ để bắt đầu lại.</p><button className="primary" onClick={()=>location.reload()}>Tải lại</button><button className="secondary" onClick={()=>{localStorage.removeItem('tea-cart');location.reload();}}>Xóa giỏ và tải lại</button></Empty></main>;return this.props.children;}
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
