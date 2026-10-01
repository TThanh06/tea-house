import React, { useEffect, useRef, useState } from 'react';
import { api, money, date, labels, iceLabel } from '../lib/api.js';
import { Icon, Cup, Modal, Field, Empty } from '../components/ui.jsx';
import Orders from './Orders.jsx';
import Reports from './Reports.jsx';
import Editor from '../components/Editor.jsx';
import PhotoEditor from '../components/PhotoEditor.jsx';
import StoreSettings from './StoreSettings.jsx';

export default function Admin({notify,refreshCatalog}){
  const [tab,setTab]=useState('orders'),[data,setData]=useState(null),[edit,setEdit]=useState(null),[photo,setPhoto]=useState(null);
  async function load(){try{setData(await api('/admin/catalog'));}catch(e){notify(e.message);}}
  useEffect(()=>{load();},[]);
  const tabs=[['orders','Đơn hàng'],['reports','Tổng quan'],['products','Đồ uống'],['categories','Danh mục'],['toppings','Topping'],['coupons','Khuyến mãi'],['settings','Cửa hàng']];
  const defaults={products:{name:'',description:'',category_id:data?.categories[0]?.id||1,price_m:35000,price_l:42000,color:'#bc8854',active:1,available:1,featured:0},categories:{name:''},toppings:{name:'',price:7000,available:1},coupons:{code:'',discount:10000,min_total:60000,max_uses:100,expires_at:'2027-12-31T23:59:59.999Z',active:1}};
  return <><div className="section-heading"><div><span className="eyebrow">TEA HOUSE WORKSPACE</span><h1>Quản lý cửa hàng</h1></div><span className="admin-badge"><Icon name="grid"/> Quản trị viên</span></div><div className="admin-tabs">{tabs.map(([v,l])=><button key={v} className={tab===v?'selected':''} onClick={()=>setTab(v)}>{l}</button>)}</div>{tab==='orders'?<Orders admin notify={notify}/>:tab==='reports'?<Reports/>:tab==='settings'?<StoreSettings notify={notify} refreshCatalog={refreshCatalog}/>:!data?<p>Đang tải…</p>:<><div className="section-heading compact"><h2>{tabs.find(t=>t[0]===tab)[1]}</h2><button className="primary" onClick={()=>setEdit({kind:tab,value:defaults[tab]})}><Icon name="plus"/> Thêm mới</button></div><div className="table-wrap"><table><thead><tr><th>Tên / mã</th><th>Thông tin</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data[tab].map(row=><tr key={row.id}><td><b>{row.name||row.code}</b>{row.description&&<small>{row.description}</small>}</td><td>{tab==='products'?`M ${money(row.price_m)} / L ${money(row.price_l)}`:tab==='toppings'?money(row.price):tab==='coupons'?`Giảm ${money(row.discount)} · ${row.used_count}/${row.max_uses} lượt`:'#'+row.id}</td><td>{tab==='categories'?'Đang dùng':tab==='coupons'?<span className="pill">{row.active?'Đang bật':'Đã tắt'}</span>:<span className="pill">{row.active===0?'Ngừng bán':row.available?'Còn món':'Tạm hết'}</span>}</td><td><button className="secondary" onClick={()=>setEdit({kind:tab,value:row})}>Chỉnh sửa</button>{tab==='products'&&<button className="secondary" onClick={()=>setPhoto(row)}>Ảnh</button>}</td></tr>)}</tbody></table>{!data[tab].length&&<Empty title="Chưa có dữ liệu"/>}</div></>}{photo&&<PhotoEditor product={photo} onClose={()=>setPhoto(null)} onSaved={async()=>{setPhoto(null);await load();await refreshCatalog();notify('Đã cập nhật ảnh đồ uống.');}}/>}{edit&&<Editor kind={edit.kind} initial={edit.value} categories={data.categories} onClose={()=>setEdit(null)} onSaved={async()=>{setEdit(null);await load();await refreshCatalog();notify('Đã lưu thay đổi.');}}/>}</>;
}
