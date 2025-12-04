import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Fix Leaflet Icons --- 修复 Leaflet 默认图标丢失问题
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- Styles Injection --- 样式注入
const STYLES = `
  @keyframes slideDownFade { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  .animate-menu-drop { animation: slideDownFade 0.3s ease-out forwards; }
  /* Hide scrollbar but allow scrolling --- 隐藏滚动条但允许滚动 */
  .hide-scroll::-webkit-scrollbar { display: none; }
  .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  .leaflet-container { width: 100%; height: 100%; border-radius: 0.75rem; z-index: 10; }
`;

// --- Components --- 组件部分

// Map Picker Component (for Admin) --- 地图选点组件（用于管理员）
function LocationPicker({ lat, lng, onLocationSelect }) {
  // Ensure valid numbers for coordinates --- 确保坐标为有效数字
  const safeLat = isNaN(parseFloat(lat)) ? 55.8456 : parseFloat(lat);
  const safeLng = isNaN(parseFloat(lng)) ? -4.4239 : parseFloat(lng);
  const [position, setPosition] = useState([safeLat, safeLng]);

  // Update position when props change --- 当属性变化时更新位置
  useEffect(() => { setPosition([safeLat, safeLng]); }, [lat, lng]);

  // Handle map click events --- 处理地图点击事件
  const MapEvents = () => {
    useMapEvents({ 
      click(e) { 
        const { lat, lng } = e.latlng; 
        setPosition([lat, lng]); 
        onLocationSelect(lat, lng); 
      }, 
    });
    return null;
  };

  return (
    <MapContainer center={position} zoom={13} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
      <Marker position={position}></Marker>
      <MapEvents />
    </MapContainer>
  );
}

// Core Carousel Component (Netflix-style click-to-scroll) --- 核心轮播组件（Netflix 风格点击滚动）
function JsCarousel({ title, items, renderItem, onViewAll }) {
  const containerRef = useRef(null);
  
  // Scroll distance: Card width (320px) + Margin (24px) --- 滑动距离：卡片宽度 (320px) + 间距 (24px)
  const SCROLL_AMOUNT = 344; 

  // Auto-reset scroll position on data load --- 数据加载时自动重置滚动位置
  useEffect(() => {
    const resetScroll = () => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
      }
    };
    requestAnimationFrame(resetScroll);
    const timer = setTimeout(resetScroll, 50);
    return () => clearTimeout(timer);
  }, [items]);

  // Handle slide logic --- 处理滑动逻辑
  const slide = (offset) => {
    if (containerRef.current) {
      const currentScroll = containerRef.current.scrollLeft;
      // If scrolling left near start, reset to 0 --- 如果向左滑动且接近起点，归零
      if (offset < 0 && currentScroll < SCROLL_AMOUNT) {
         containerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
         containerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="w-full py-10 group bg-white border-b border-gray-100">
      <div className="container mx-auto px-6 flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{title}</h2>
        
        {/* Navigation Buttons --- 导航按钮组 */}
        <div className="flex items-center gap-3">
           <button onClick={() => slide(-SCROLL_AMOUNT)} className="p-2 rounded-full border border-gray-200 hover:border-blue-600 hover:text-blue-600 transition-colors text-gray-400 bg-white shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
           </button>
           <button onClick={() => slide(SCROLL_AMOUNT)} className="p-2 rounded-full border border-gray-200 hover:border-blue-600 hover:text-blue-600 transition-colors text-gray-400 bg-white shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </button>
           {onViewAll && <div className="h-6 w-px bg-gray-200 mx-2"></div>}
           {onViewAll && (<button onClick={onViewAll} className="text-sm font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wide transition-colors">View All</button>)}
        </div>
      </div>

      {/* Scroll Container --- 滚动容器 */}
      <div ref={containerRef} className="flex overflow-x-auto hide-scroll w-full pb-12">
         <div className="w-6 shrink-0" /> {/* Left Spacer --- 左侧垫片 */}
         {items.map((item) => (
           <div key={item.id} className="shrink-0 mr-6">
             {renderItem(item)}
           </div>
         ))}
         <div className="w-6 shrink-0" /> {/* Right Spacer --- 右侧垫片 */}
      </div>
    </div>
  );
}

// MegaMenu Component --- 下拉大菜单组件
function MegaMenu({ events, setPage, setCurrentEventId, closeMenu, onMouseEnter, onMouseLeave }) {
  return (
    <div className="absolute top-full left-0 w-full bg-white shadow-xl z-50 border-t animate-menu-drop" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="container mx-auto p-8">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Explore Events</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.map(event => (
            <div key={event.id} onClick={() => { setCurrentEventId(event.id); setPage('EventDetail'); closeMenu(); }} className="flex items-center space-x-4 p-3 rounded-xl hover:bg-gray-50 transition cursor-pointer group">
              <img src={event.image} alt={event.name} className="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition bg-gray-200" />
              <div><h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition">{event.name}</h4><p className="text-sm text-gray-500 line-clamp-1">{event.description}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Navbar Component --- 导航栏组件
function Navbar({ setPage, user, setUser, events, setCurrentEventId }) {
  const [showEventsMenu, setShowEventsMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const timeoutRef = useRef(null);

  // Auto-hide navbar on scroll --- 滚动时自动隐藏导航栏
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 60 && currentScrollY > lastScrollY) setIsVisible(false); else setIsVisible(true);
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Delay hiding menu for UX --- 延时隐藏菜单以提升用户体验
  const handleMouseEnter = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); setShowEventsMenu(true); setIsVisible(true); };
  const handleMouseLeave = () => { timeoutRef.current = setTimeout(() => { setShowEventsMenu(false); }, 200); };
  
  return (
    <>
      <style>{STYLES}</style>
      <nav className={`bg-white shadow-md fixed top-0 w-full z-50 transition-transform duration-300 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'}`} onMouseEnter={() => setIsVisible(true)}>
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="cursor-pointer flex items-center w-48" onClick={() => setPage('Home')}>
             <svg className="w-8 h-8 text-blue-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
             <span className="text-xl font-extrabold text-gray-900 tracking-tighter">PAISLEY<span className="text-blue-600">GAMES</span></span>
          </div>
          <div className="hidden md:flex items-center justify-center flex-1 h-full">
            <div className="flex space-x-8 h-full items-center">
              <button onClick={() => setPage('Home')} className="text-gray-600 hover:text-blue-600 font-medium transition h-full px-2">Home</button>
              <div className="relative h-full flex items-center" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                <button onClick={() => setPage('Events')} className="text-gray-600 hover:text-blue-600 font-medium transition h-full px-2">Events</button>
              </div>
              <button onClick={() => setPage('Register')} className="text-gray-600 hover:text-blue-600 font-medium transition h-full px-2">Register</button>
              {user && user.role === 'admin' && (<button onClick={() => setPage('Admin')} className="text-red-600 hover:text-red-800 font-medium transition h-full px-2">Admin Panel</button>)}
              {user && user.role === 'user' && (<button onClick={() => setPage('UserDashboard')} className="text-blue-600 hover:text-blue-800 font-medium transition h-full px-2">My Registrations</button>)}
            </div>
          </div>
          <div className="w-48 flex justify-end">
            {user ? (
              <div className="flex items-center space-x-4"><span className="text-sm font-medium text-gray-500 hidden lg:block">Hi, {user.username}</span><button onClick={() => { setUser(null); setPage('Home'); }} className="text-sm font-bold text-gray-500 hover:text-gray-900">Logout</button></div>
            ) : (<button onClick={() => setPage('Login')} className="bg-gray-900 text-white px-6 py-2 rounded-full hover:bg-gray-800 transition text-sm font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">Login</button>)}
          </div>
        </div>
        {showEventsMenu && (<MegaMenu events={events} setPage={setPage} setCurrentEventId={setCurrentEventId} closeMenu={() => setShowEventsMenu(false)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />)}
      </nav>
      <div className="h-20" />
    </>
  );
}

// Hero Carousel (2.35:1) --- 首页大图轮播
function HeroCarousel({ slides, setPage }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  
  // Auto-play logic --- 自动播放逻辑
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % (slides.length || 1));
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + (slides.length || 1)) % (slides.length || 1));
  useEffect(() => { if (isDragging) return; const timer = setInterval(nextSlide, 6000); return () => clearInterval(timer); }, [slides.length, isDragging]);
  
  // Drag/Swipe logic --- 拖拽/滑动逻辑
  const handleDragStart = (e) => { setIsDragging(true); setStartX(e.touches ? e.touches[0].clientX : e.clientX); };
  const handleDragMove = (e) => { if (!isDragging) return; setDragOffset((e.touches ? e.touches[0].clientX : e.clientX) - startX); };
  const handleDragEnd = () => { setIsDragging(false); if (dragOffset < -50) nextSlide(); if (dragOffset > 50) prevSlide(); setDragOffset(0); };

  if (!slides.length) return <div className="w-full aspect-[2.35/1] bg-gray-200 animate-pulse" />;
  return (
    <div className="relative w-full aspect-[2.35/1] overflow-hidden cursor-grab active:cursor-grabbing bg-gray-900 group" onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd} onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}>
      <div className="flex h-full" style={{ width: `${slides.length * 100}%`, transform: `translateX(calc(-${(currentSlide * 100) / slides.length}% + ${dragOffset}px))`, transition: isDragging ? 'none' : 'transform 0.5s ease-out' }}>
        {slides.map((slide) => (
          <div key={slide.id} className="w-full h-full bg-cover bg-center relative" style={{ backgroundImage: `url('${slide.image}')`, width: `${100 / slides.length}%` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="relative z-10 h-full flex flex-col items-start justify-end text-left text-white p-8 md:p-16 container mx-auto">
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 drop-shadow-md tracking-tight opacity-90 leading-tight">{slide.title}</h1>
              <p className="text-sm md:text-lg mb-6 font-light drop-shadow-sm max-w-2xl opacity-80 hidden md:block">{slide.subtitle}</p>
              <button onClick={() => setPage(slide.action)} className="bg-white/10 hover:bg-white/30 backdrop-blur-md border border-white/50 text-white px-4 py-2 md:px-6 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition">{slide.button_text}</button>
            </div>
          </div>
        ))}
      </div>
      {/* Carousel Controls --- 轮播控制按钮 */}
      <button onClick={(e) => { e.stopPropagation(); prevSlide(); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
      <button onClick={(e) => { e.stopPropagation(); nextSlide(); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition opacity-0 group-hover:opacity-100 z-30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
      <div className="absolute bottom-8 right-8 flex space-x-2 z-20">{slides.map((_, idx) => (<button key={idx} onClick={(e) => { e.stopPropagation(); setCurrentSlide(idx); }} className={`h-1.5 transition-all duration-300 rounded-full ${currentSlide === idx ? 'w-8 bg-white' : 'w-4 bg-white/30'}`} />))}</div>
    </div>
  );
}

// --- Page Components --- 页面组件

// Event Detail Page --- 赛事详情页
function EventDetailPage({ eventId, setPage }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/events/${eventId}`).then(res => res.json()).then(data => { setEvent(data); setLoading(false); }).catch(err => setLoading(false));
  }, [eventId]);

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!event) return <div className="text-center py-20">Event not found.</div>;

  // Parse coordinates safely --- 安全解析坐标
  const lat = isNaN(parseFloat(event.lat)) ? 55.8456 : parseFloat(event.lat);
  const lng = isNaN(parseFloat(event.lng)) ? -4.4239 : parseFloat(event.lng);

  return (
    <div className="container mx-auto px-6 py-12">
      <button onClick={() => setPage('Events')} className="mb-6 text-gray-500 hover:text-gray-900 font-medium flex items-center transition hover:-translate-x-1">← Back</button>
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
        <div className="h-80 w-full relative bg-gray-200">
           <img src={event.image} alt={event.name} className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
           <h1 className="absolute bottom-8 left-8 text-3xl md:text-5xl font-bold text-white shadow-sm">{event.name}</h1>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">About the Event</h3>
            <p className="text-gray-600 text-lg leading-relaxed">{event.description}</p>
            <div className="mt-8 pt-6 border-t"><button onClick={() => setPage('Register')} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg transform hover:-translate-y-1 w-full md:w-auto">Register Now</button></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Date & Time</h4>
              <p className="text-lg font-semibold text-gray-900">{event.event_date || 'Saturday, August 15'}</p>
              <p className="text-sm text-gray-600">{event.event_time || '10:00 AM - 12:00 PM'}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Location</h4>
              <p className="text-lg font-semibold text-gray-900">{event.location || 'Main Arena'}</p>
            </div>
          </div>
        </div>
        <div className="md:col-span-1">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 h-full min-h-[300px]">
            <iframe width="100%" height="100%" className="rounded-xl w-full h-full min-h-[300px]" frameBorder="0" scrolling="no" marginHeight="0" marginWidth="0" src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}></iframe>
          </div>
        </div>
      </div>
    </div>
  );
}

// Home Page --- 首页
function HomePage({ setPage, slides, events, tally, heritage, setCurrentEventId }) {
  return (
    <div>
      <HeroCarousel slides={slides} setPage={setPage} />
      
      {/* Featured Events Section --- 特色赛事部分 */}
      <JsCarousel 
        title="Featured Competitions" 
        items={events} 
        onViewAll={() => setPage('Events')}
        renderItem={(event) => (
          <div 
            onClick={() => { setCurrentEventId(event.id); setPage('EventDetail'); }} 
            className="w-80 bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group overflow-hidden border border-gray-100 h-full"
          >
            <div className="h-48 overflow-hidden bg-gray-200"><img src={event.image} alt={event.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" /></div>
            <div className="p-5"><h3 className="text-lg font-bold mb-2 group-hover:text-blue-600">{event.name}</h3><p className="text-gray-500 text-sm line-clamp-2">{event.description}</p></div>
          </div>
        )}
      />

      {/* Heritage Section --- 文化历史部分 */}
      <div className="bg-gray-50">
        <JsCarousel 
          title="Discover Our Heritage" 
          items={heritage}
          renderItem={(item) => (
            <div className="w-96 bg-white rounded-xl shadow-sm hover:shadow-md transition cursor-default border border-gray-200 overflow-hidden flex h-full">
              <div className="w-32 h-full shrink-0 bg-gray-200"><img src={item.image} alt={item.title} className="w-full h-full object-cover" /></div>
              <div className="p-4 flex flex-col justify-center"><h3 className="text-base font-bold text-gray-800 mb-1">{item.title}</h3><p className="text-xs text-gray-500 leading-relaxed">{item.description}</p></div>
            </div>
          )}
        />
      </div>
      
      <div className="py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Clan Standings</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100 border-b">
                <tr><th className="px-6 py-4 text-left font-semibold text-gray-600">Team / Clan</th><th className="px-4 py-4 text-center text-yellow-600">Gold</th><th className="px-4 py-4 text-center text-gray-500">Silver</th><th className="px-4 py-4 text-center text-orange-700">Bronze</th><th className="px-6 py-4 text-center font-bold">Total</th></tr>
              </thead>
              <tbody>
                {tally.map((team, idx) => (
                  <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-800">{team.team_name}</td><td className="px-4 py-4 text-center">{team.gold}</td><td className="px-4 py-4 text-center">{team.silver}</td><td className="px-4 py-4 text-center">{team.bronze}</td><td className="px-6 py-4 text-center font-bold text-lg">{team.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Events List Page --- 所有赛事列表页
function EventsPage({ events, setCurrentEventId, setPage }) {
  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold text-center mb-12 text-gray-900">All Competitions</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-full hover:shadow-xl transition group">
            <div className="h-56 overflow-hidden bg-gray-200"><img src={event.image} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /></div>
            <div className="p-6 flex-grow flex flex-col">
              <h3 className="text-2xl font-bold mb-3 text-gray-900">{event.name}</h3><p className="text-gray-600 mb-6 flex-grow line-clamp-3">{event.description}</p>
              <button onClick={() => { setCurrentEventId(event.id); setPage('EventDetail'); }} className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-medium self-start">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Registration Page --- 报名页
function RegistrationPage({ events }) {
  const [formData, setFormData] = useState({ name: '', email: '', type: 'individual' });
  const [selectedEvents, setSelectedEvents] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Handle submission logic (sends one request with array) --- 处理提交逻辑（发送包含数组的单个请求）
  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    const eventsToRegister = Object.keys(selectedEvents).filter(name => selectedEvents[name]);
    if (eventsToRegister.length === 0) { setIsSubmitting(false); return setMessage({ type: 'error', text: 'Select at least one event.' }); }
    try { const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, eventNames: eventsToRegister }) }); if (!response.ok) throw new Error('Failed'); setMessage({ type: 'success', text: 'Submitted! A confirmation email has been sent.' }); setFormData({ name: '', email: '', type: 'individual' }); setSelectedEvents({}); } catch (error) { setMessage({ type: 'error', text: 'Error submitting form.' }); } finally { setIsSubmitting(false); }
  };
  
  return (
    <div className="container mx-auto px-6 py-12 max-w-2xl">
      <h1 className="text-4xl font-bold text-center mb-10 text-gray-900">Registration</h1>
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div><label className="block text-gray-700 font-semibold mb-2">Name / Team</label><input type="text" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="block text-gray-700 font-semibold mb-2">Type</label><select className="w-full px-4 py-3 border rounded-lg bg-white outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}><option value="individual">Individual</option><option value="group">Group / Team</option></select></div>
          </div>
          <div><label className="block text-gray-700 font-semibold mb-2">Email</label><input type="email" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
          <div><label className="block text-gray-700 font-semibold mb-3">Select Competitions</label><div className="bg-gray-50 p-4 rounded-xl h-48 overflow-y-auto border border-gray-200 space-y-2">{events.map(event => (<label key={event.id} className="flex items-center p-2 hover:bg-white rounded cursor-pointer transition"><input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" checked={!!selectedEvents[event.name]} onChange={() => setSelectedEvents(p => ({...p, [event.name]: !p[event.name]}))} /><span className="ml-3 text-gray-700 font-medium">{event.name}</span></label>))}</div></div>
          {message && <div className={`p-4 rounded-lg text-center font-medium ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{message.text}</div>}
          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-50">{isSubmitting ? 'Processing...' : 'Submit Application'}</button>
        </form>
      </div>
    </div>
  );
}

// Login Page --- 登录/注册页
function LoginPage({ setUser, setPage }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (isLogin) {
      try { const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formData.username, password: formData.password }) }); const data = await res.json(); if (data.success) { setUser(data.user); setPage(data.user.role === 'admin' ? 'Admin' : 'UserDashboard'); } else { setError(data.message || 'Invalid credentials'); } } catch { setError('Server error'); }
    } else {
      try { const res = await fetch('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); const data = await res.json(); if (data.success) { setSuccess('Account created! Please log in.'); setIsLogin(true); } else { setError(data.message || 'Signup failed'); } } catch { setError('Server error'); }
    }
  };
  return (
    <div className="container mx-auto px-6 py-20 flex justify-center">
      <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-2xl border border-gray-100">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div><label className="block text-gray-700 font-medium mb-2">Username / Email</label><input type="text" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder={isLogin ? "Username or Email" : "Pick a username"} /></div>
          {!isLogin && (<div><label className="block text-gray-700 font-medium mb-2">Email Address</label><input type="email" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>)}
          <div><label className="block text-gray-700 font-medium mb-2">Password</label><input type="password" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
          {success && <p className="text-green-600 text-center text-sm">{success}</p>}
          <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold hover:bg-black transition">{isLogin ? 'Login' : 'Sign Up'}</button>
        </form>
        <div className="mt-6 text-center text-sm"><p className="text-gray-500">{isLogin ? "Don't have an account? " : "Already have an account? "}<button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="text-blue-600 font-bold hover:underline">{isLogin ? "Sign Up" : "Login"}</button></p></div>
      </div>
    </div>
  );
}

// User Dashboard --- 用户仪表盘
function UserDashboard({ user }) {
  const [myRegs, setMyRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (user?.email) { fetch(`/api/user/my-registrations?email=${user.email}`).then(r => r.json()).then(data => { setMyRegs(data); setLoading(false); }).catch(err => setLoading(false)); } }, [user]);
  if (loading) return <div className="text-center py-20">Loading your registrations...</div>;
  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">My Registrations</h1>
      <p className="text-gray-500 mb-8">Welcome back, {user.username}. Here are your competition entries.</p>
      {myRegs.length === 0 ? (<div className="p-8 bg-gray-50 rounded-xl text-center border border-gray-200"><p className="text-gray-600">You haven't registered for any events yet.</p></div>) : (
        <div className="space-y-4">{myRegs.map(reg => (<div key={reg.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4"><div><h3 className="font-bold text-xl text-gray-900">{reg.event_name}</h3><div className="flex items-center text-sm text-gray-500 mt-1 space-x-4"><span>📅 {reg.event_date}</span><span>📍 {reg.location}</span></div><p className="text-xs text-gray-400 mt-2">Registered on: {new Date(reg.created_at).toLocaleDateString()}</p></div><div><span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${reg.status === 'approved' ? 'bg-green-100 text-green-700' : reg.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{reg.status}</span></div></div>))}</div>
      )}
    </div>
  );
}

// Admin Dashboard --- 管理员仪表盘
function AdminDashboard() {
  const [tab, setTab] = useState('registrations'); 
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [slides, setSlides] = useState([]);
  const [heritage, setHeritage] = useState([]); 
  const [editingItem, setEditingItem] = useState(null); 
  const [editType, setEditType] = useState(null); 

  useEffect(() => { fetchData(); }, []);
  const fetchData = () => { 
    fetch('/api/admin/registrations').then(r => r.json()).then(setRegistrations); 
    fetch('/api/events').then(r => r.json()).then(setEvents); 
    fetch('/api/slides').then(r => r.json()).then(setSlides);
    fetch('/api/heritage').then(r => r.json()).then(setHeritage); 
  };
  const updateRegStatus = async (id, status) => { await fetch(`/api/admin/registrations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); fetchData(); };
  
  const handleEditSubmit = async (e) => { 
    e.preventDefault(); 
    let endpoint = '';
    if (editType === 'event') endpoint = `/api/admin/events/${editingItem.id}`;
    if (editType === 'slide') endpoint = `/api/admin/slides/${editingItem.id}`;
    if (editType === 'heritage') endpoint = `/api/admin/heritage/${editingItem.id}`;

    await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingItem) }); 
    setEditingItem(null); setEditType(null); fetchData(); alert('Update successful!'); 
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex bg-white p-1 rounded-lg shadow border overflow-hidden">
          {['registrations', 'events', 'slides', 'heritage'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 capitalize font-medium transition ${tab === t ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-h-[500px]">
        {tab === 'registrations' && (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4 text-left font-semibold text-gray-600">User</th><th className="px-6 py-4 text-left font-semibold text-gray-600">Event</th><th className="px-6 py-4 text-center font-semibold text-gray-600">Status</th><th className="px-6 py-4 text-center font-semibold text-gray-600">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-200">{registrations.map(reg => (<tr key={reg.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-medium">{reg.user_name} <span className="block text-xs text-gray-500 font-normal">{reg.email}</span></td><td className="px-6 py-4">{reg.event_name}</td><td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-bold ${reg.status === 'approved' ? 'bg-green-100 text-green-700' : reg.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{reg.status}</span></td><td className="px-6 py-4 text-center space-x-2"><button onClick={() => updateRegStatus(reg.id, 'approved')} className="text-green-600 hover:text-green-900 text-sm font-bold">Approve</button><button onClick={() => updateRegStatus(reg.id, 'rejected')} className="text-red-600 hover:text-red-900 text-sm font-bold">Reject</button></td></tr>))}</tbody>
          </table>
        )}
        {tab === 'events' && (<div className="p-6 grid gap-4">{events.map(ev => (<div key={ev.id} className="flex items-center justify-between border-b pb-4 last:border-0"><div className="flex items-center space-x-4"><div className="w-12 h-12 bg-gray-200 rounded overflow-hidden"><img src={ev.image} className="w-full h-full object-cover" /></div><div><h4 className="font-bold">{ev.name}</h4><p className="text-xs text-gray-500 line-clamp-1">{ev.description}</p></div></div><button onClick={() => { setEditingItem(ev); setEditType('event'); }} className="text-blue-600 font-medium hover:underline">Edit</button></div>))}</div>)}
        {tab === 'slides' && (<div className="p-6 grid gap-4">{slides.map(slide => (<div key={slide.id} className="flex items-center justify-between border-b pb-4 last:border-0"><div className="flex items-center space-x-4"><div className="w-16 h-10 bg-gray-200 rounded overflow-hidden"><img src={slide.image} className="w-full h-full object-cover" /></div><div><h4 className="font-bold text-sm">{slide.title}</h4><p className="text-xs text-gray-500">{slide.subtitle}</p></div></div><button onClick={() => { setEditingItem(slide); setEditType('slide'); }} className="text-blue-600 font-medium hover:underline">Edit</button></div>))}</div>)}
        {tab === 'heritage' && (<div className="p-6 grid gap-4">{heritage.map(h => (<div key={h.id} className="flex items-center justify-between border-b pb-4 last:border-0"><div className="flex items-center space-x-4"><div className="w-12 h-12 bg-gray-200 rounded overflow-hidden"><img src={h.image} className="w-full h-full object-cover" /></div><div><h4 className="font-bold">{h.title}</h4><p className="text-xs text-gray-500 line-clamp-1">{h.description}</p></div></div><button onClick={() => { setEditingItem(h); setEditType('heritage'); }} className="text-blue-600 font-medium hover:underline">Edit</button></div>))}</div>)}
      </div>
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 capitalize">Edit {editType}</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
              {editType === 'event' && (<>
                <div><label className="text-sm font-bold text-gray-700">Name</label><input className="w-full border p-2 rounded" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} /></div>
                <div><label className="text-sm font-bold text-gray-700">Description</label><textarea rows="3" className="w-full border p-2 rounded" value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-bold text-gray-700">Date</label><input className="w-full border p-2 rounded" value={editingItem.event_date || ''} onChange={e => setEditingItem({...editingItem, event_date: e.target.value})} /></div>
                  <div><label className="text-sm font-bold text-gray-700">Time</label><input className="w-full border p-2 rounded" value={editingItem.event_time || ''} onChange={e => setEditingItem({...editingItem, event_time: e.target.value})} /></div>
                </div>
                <div><label className="text-sm font-bold text-gray-700">Location Name</label><input className="w-full border p-2 rounded" value={editingItem.location || ''} onChange={e => setEditingItem({...editingItem, location: e.target.value})} /></div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Map Location (Click to update)</label>
                  <div className="h-64 rounded-xl overflow-hidden border border-gray-300"><LocationPicker lat={editingItem.lat} lng={editingItem.lng} onLocationSelect={(lat, lng) => setEditingItem({...editingItem, lat, lng})} /></div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500"><span>Lat: {Number(editingItem.lat || 0).toFixed(6)}</span><span>Lng: {Number(editingItem.lng || 0).toFixed(6)}</span></div>
                </div>
                <div><label className="text-sm font-bold text-gray-700">Image Path</label><input className="w-full border p-2 rounded" value={editingItem.image} onChange={e => setEditingItem({...editingItem, image: e.target.value})} /></div>
              </>)}
              {editType === 'slide' && (<>
                <div><label className="text-sm font-bold text-gray-700">Title</label><input className="w-full border p-2 rounded" value={editingItem.title} onChange={e => setEditingItem({...editingItem, title: e.target.value})} /></div>
                <div><label className="text-sm font-bold text-gray-700">Subtitle</label><input className="w-full border p-2 rounded" value={editingItem.subtitle} onChange={e => setEditingItem({...editingItem, subtitle: e.target.value})} /></div>
                <div><label className="text-sm font-bold text-gray-700">Button Text</label><input className="w-full border p-2 rounded" value={editingItem.button_text} onChange={e => setEditingItem({...editingItem, button_text: e.target.value})} /></div>
                <div><label className="text-sm font-bold text-gray-700">Image Path</label><input className="w-full border p-2 rounded" value={editingItem.image} onChange={e => setEditingItem({...editingItem, image: e.target.value})} /></div>
              </>)}
              {editType === 'heritage' && (<>
                <div><label className="text-sm font-bold text-gray-700">Title</label><input className="w-full border p-2 rounded" value={editingItem.title} onChange={e => setEditingItem({...editingItem, title: e.target.value})} /></div>
                <div><label className="text-sm font-bold text-gray-700">Description</label><textarea rows="3" className="w-full border p-2 rounded" value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} /></div>
                <div><label className="text-sm font-bold text-gray-700">Image Path</label><input className="w-full border p-2 rounded" value={editingItem.image} onChange={e => setEditingItem({...editingItem, image: e.target.value})} /></div>
              </>)}
              <div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={() => { setEditingItem(null); setEditType(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Save Changes</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main App Component --- 主应用组件
export default function App() {
  const [page, setPage] = useState('Home');
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [slides, setSlides] = useState([]);
  const [tally, setTally] = useState([]);
  const [heritage, setHeritage] = useState([]); 
  const [currentEventId, setCurrentEventId] = useState(null);

  // Load data on app start --- 应用启动时加载数据
  useEffect(() => {
    document.title = "Paisley Highland Games 2025";
    const load = () => { 
      Promise.all([fetch('/api/events'), fetch('/api/slides'), fetch('/api/tally'), fetch('/api/heritage')])
      .then(res => Promise.all(res.map(r => r.json())))
      .then(([e, s, t, h]) => { setEvents(e); setSlides(s); setTally(t); setHeritage(h); })
      .catch(console.error); 
    };
    load();
  }, [page]);

  // Simple router logic --- 简单的路由逻辑
  let content;
  switch (page) {
    case 'Home': content = <HomePage setPage={setPage} slides={slides} events={events} tally={tally} heritage={heritage} setCurrentEventId={setCurrentEventId} />; break;
    case 'Events': content = <EventsPage events={events} setCurrentEventId={setCurrentEventId} setPage={setPage} />; break;
    case 'EventDetail': content = <EventDetailPage eventId={currentEventId} setPage={setPage} />; break;
    case 'Register': content = <RegistrationPage events={events} />; break;
    case 'Login': content = <LoginPage setUser={setUser} setPage={setPage} />; break;
    case 'Admin': content = (user?.role === 'admin') ? <AdminDashboard /> : <HomePage setPage={setPage} slides={slides} events={events} tally={tally} heritage={heritage} setCurrentEventId={setCurrentEventId} />; break;
    case 'UserDashboard': content = (user?.role === 'user') ? <UserDashboard user={user} /> : <LoginPage setUser={setUser} setPage={setPage} />; break;
    default: content = <HomePage setPage={setPage} slides={slides} events={events} tally={tally} heritage={heritage} setCurrentEventId={setCurrentEventId} />;
  }
  return (
    <div className="font-sans bg-gray-50 min-h-screen flex flex-col">
      <Navbar setPage={setPage} user={user} setUser={setUser} events={events} setCurrentEventId={setCurrentEventId} />
      <main className="flex-grow">{content}</main>
      <footer className="bg-gray-900 text-gray-400 py-12 mt-auto">
        <div className="container mx-auto px-6 text-center"><p className="text-white font-bold text-lg mb-2">Paisley Highland Games 2025</p><p className="text-sm">Proof of Concept for COMP10020</p></div>
      </footer>
    </div>
  );
}