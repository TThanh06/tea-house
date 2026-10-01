export const money=n=>Number(n||0).toLocaleString('vi-VN')+'đ';
export const date=s=>new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
export const labels={pending:'Chờ xác nhận',confirmed:'Đã xác nhận',preparing:'Đang pha chế',delivering:'Đang giao',ready:'Chờ nhận tại quầy',completed:'Hoàn thành',cancelled:'Đã hủy',failed:'Giao thất bại',uncollected:'Không đến nhận'};
export const iceLabel={none:'Không đá',less:'Ít đá',normal:'Đá bình thường'};
export async function api(path,options={}){
  const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Không thể kết nối.');return data;
}
