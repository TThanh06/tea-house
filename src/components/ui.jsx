import React, { useEffect, useRef } from 'react';

export function Icon({name,size=20}){
  const paths={bag:<><path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,arrow:<><path d="M4 12h15M13 6l6 6-6 6"/></>,user:<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,close:<path d="m6 6 12 12M18 6 6 18"/>,plus:<path d="M12 5v14M5 12h14"/>,minus:<path d="M5 12h14"/>,leaf:<><path d="M20 3C4 2 1 11 8 17c8 7 14-3 12-14Z"/><path d="m4 21 11-12"/></>,check:<path d="m5 12 4 4L20 5"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.leaf}</svg>;
}

export function Cup({color='#bc8854',id='cup',big=false}){
  return <svg className={'cup '+(big?'big':'')} viewBox="0 0 240 280" role="img" aria-label="Minh họa ly trà sữa"><defs><linearGradient id={'tea'+id} x1="0" y1="0" x2="1" y2="1"><stop stopColor={color}/><stop offset="1" stopColor="#f2dcc0"/></linearGradient><linearGradient id={'glass'+id}><stop stopColor="#fff" stopOpacity=".42"/><stop offset=".5" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#fff" stopOpacity=".27"/></linearGradient></defs><ellipse cx="119" cy="254" rx="68" ry="12" fill="#64391e" opacity=".12"/><path d="m130 19 12 2-17 87-12-2Z" fill="#78472f"/><path d="M58 77h124l-16 160q-44 22-90 0Z" fill={'url(#tea'+id+')'} stroke="#fff8e9" strokeWidth="3"/><path d="M58 77h124l-3 36q-57 16-118-1Z" fill="#f5e6cf" opacity=".85"/><ellipse cx="120" cy="77" rx="62" ry="15" fill="#f9eddb" stroke="#fff8e9" strokeWidth="3"/><ellipse cx="120" cy="77" rx="54" ry="9" fill={color} opacity=".4"/><path d="m120 67 8 1 9-47-8-1Z" fill="#78472f"/><g fill="#4d3025">{[[87,221],[108,230],[134,228],[155,220],[100,207],[123,211],[144,205],[87,195],[116,190],[141,185]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={8-i%3} opacity={.85}/>)}</g><path d="M60 83h120l-15 151q-42 20-88 0Z" fill={'url(#glass'+id+')'}/><path d="m71 96 10 113" stroke="white" strokeWidth="4" opacity=".35" strokeLinecap="round"/><circle cx="122" cy="150" r="25" fill="#fff7e9"/><path d="M122 133c-14 4-13 18 0 20 12-6 10-18 0-20Z" fill="#8b422e"/><path d="M122 138v23" stroke="#fff7e9" strokeWidth="1.5"/><text x="122" y="168" textAnchor="middle" fontSize="6" letterSpacing="1.2" fill="#8b422e">TEA HOUSE</text></svg>;
}

export function Modal({title,onClose,children,wide=false}){
  const ref=useRef();useEffect(()=>{const d=ref.current;d.showModal();const cancel=e=>{e.preventDefault();onClose();};d.addEventListener('cancel',cancel);return()=>{d.removeEventListener('cancel',cancel);d.close();};},[]);
  return <dialog ref={ref} className={'modal '+(wide?'wide':'')} aria-label={title} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-top"><h2>{title}</h2><button className="icon-btn" aria-label="Đóng" onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;
}

export function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>;}

export function Empty({title,children}){return <div className="empty"><Icon name="bag" size={40}/><h3>{title}</h3>{children}</div>;}
