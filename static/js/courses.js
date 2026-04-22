const API_BASE = '';
let PRODUCT_CATALOG_CACHE = [];

const COURSE_LIST = [
    { 
        cat: "Guitar", 
        title: "Guitar Cổ điển & Hiện đại", 
        desc: "Học ngón tay linh hoạt, đệm hát mượt mà và chinh phục những bản nhạc bạn yêu thích — từ dân ca đến pop hiện đại.", 
        time: "9 tháng", 
        students: "12 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/guitar_course.mp4"  
    },
    { 
        cat: "Violin", 
        title: "Nghệ thuật diễn tấu Violin", 
        desc: "Làm chủ cây vĩ, cảm nhận từng sắc thái âm thanh và tự tin trình diễn trước khán giả với tư thế chuẩn học thuật.", 
        time: "1 năm", 
        students: "10 học viên", 
        rate: 4.8, 
        video: "/static/icons/video_course/violin_course.mp4"
    },
    { 
        cat: "Piano", 
        title: "Piano – Hệ thống kỹ thuật ngón", 
        desc: "Từ những nốt nhạc đầu tiên đến tác phẩm hoàn chỉnh — xây dựng nền tảng vững chắc để chơi bất kỳ thể loại nào bạn muốn.", 
        time: "1 năm", 
        students: "15 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/piano_course.mp4"
    },
    { 
        cat: "Dân gian", 
        title: "Nhạc khí truyền thống Việt Nam", 
        desc: "Chạm đến hồn nhạc dân tộc qua tiếng đàn Tranh, đàn Bầu — gìn giữ di sản âm nhạc Việt theo cách sống động nhất.", 
        time: "9 tháng", 
        students: "12 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/harp_course.mp4" 
    },
    { 
        cat: "Drum", 
        title: "Bộ gõ & Tiết tấu chuyên sâu", 
        desc: "Cảm nhận nhịp điệu bằng cả cơ thể, phối hợp tay chân nhịp nhàng và trở thành trụ cột giữ nhịp cho ban nhạc.", 
        time: "6 tháng", 
        students: "10 học viên", 
        rate: 4.9, 
        video: "/static/icons/video_course/drum_course.mp4"
    },
    { 
        cat: "Flute", 
        title: "Sáo Flute & Nghệ thuật hơi thở", 
        desc: "Học cách biến hơi thở thành âm thanh — tinh tế, trong trẻo và biểu cảm như chính cảm xúc bạn muốn truyền tải.", 
        time: "6 tháng", 
        students: "8 học viên", 
        rate: 4.7, 
        video: "/static/icons/video_course/flute_course.mp4"
    },
    { 
        cat: "Ukulele", 
        title: "Ukulele & Nhạc lý ứng dụng", 
        desc: "Khởi đầu hành trình âm nhạc thật vui và dễ dàng — chỉ vài tuần là bạn có thể tự đệm và hát những bài yêu thích.", 
        time: "3 tháng", 
        students: "18 học viên", 
        rate: 4.9, 
        video: "/static/icons/video_course/ukulele_course.mp4"
    },
    { 
        cat: "Organ", 
        title: "Thủ pháp biểu diễn Keyboard", 
        desc: "Khai thác toàn bộ sức mạnh của cây đàn Organ — từ phối âm phong phú đến độc tấu chuyên nghiệp trên sân khấu.", 
        time: "9 tháng", 
        students: "12 học viên", 
        rate: 4.8, 
        video: "/static/icons/video_course/organ_course.mp4" 
    },
    { 
        cat: "Ca hát", 
        title: "Nghệ thuật Ca hát & Biểu diễn", 
        desc: "Tìm lại giọng hát thật sự của bạn — tự tin đứng trên sân khấu, hát đúng kỹ thuật và truyền cảm xúc đến người nghe.", 
        time: "6 tháng", 
        students: "20 học viên", 
        rate: 4.6, 
        video: "/static/icons/video_course/vocal_course.mp4"
    },
    { 
        cat: "Thanh nhạc", 
        title: "Thanh nhạc Cổ điển chuyên sâu", 
        desc: "Rèn luyện giọng hát chuẩn học thuật — kiểm soát hơi thở, cộng minh âm thanh và chinh phục các tác phẩm thính phòng đỉnh cao.", 
        time: "1 năm", 
        students: "8 học viên", 
        rate: 5.0, 
        img: "/static/icons/video_course/thanhnhac_course.jpg" 
    },
    { 
        cat: "Nhạc lí", 
        title: "Lý thuyết âm nhạc tổng quát", 
        desc: "Hiểu \"ngôn ngữ\" đằng sau mọi bản nhạc — học cách đọc, viết và cảm nhận âm nhạc một cách có hệ thống từ gốc rễ.", 
        time: "4 tháng", 
        students: "25 học viên", 
        rate: 4.9, 
        video: "/static/icons/video_course/nhacli_course.mp4" 
    },
    { 
        cat: "Lịch sử", 
        title: "Lịch sử âm nhạc", 
        desc: "Khám phá hành trình âm nhạc nhân loại qua các thời đại — hiểu sâu hơn những tác phẩm bạn yêu thích và lý do chúng trường tồn.", 
        time: "6 tháng", 
        students: "20 học viên", 
        rate: 4.8, 
        img: "/static/icons/video_course/music_history.jpg" 
    },
    { 
        cat: "Xướng âm", 
        title: "Xướng âm & Huấn luyện thính giác", 
        desc: "Rèn \"tai nghe vàng\" — nhận ra nốt nhạc, đọc bản nhạc ngay lần đầu và phản xạ tiết tấu chuẩn xác như một nhạc sĩ chuyên nghiệp.", 
        time: "6 tháng", 
        students: "15 học viên", 
        rate: 4.7, 
        img: "/static/icons/video_course/chant_course.jpg" 
    },
    { 
        cat: "Hòa âm", 
        title: "Hòa âm & Thủ pháp phối khí", 
        desc: "Học cách kết hợp nhiều nhạc cụ thành một bức tranh âm thanh hoàn chỉnh — kỹ năng thiết yếu cho người muốn sáng tác và phối khí.", 
        time: "1 năm", 
        students: "10 học viên", 
        rate: 5.0, 
        img: "/static/icons/video_course/hoam_course.jpg" 
    },
    { 
        cat: "Lí luận", 
        title: "Sáng tác & Chỉ huy dàn nhạc", 
        desc: "Dành cho người có khát vọng lớn — học cách viết nhạc, phân tích tác phẩm và đứng trên bục chỉ huy một dàn nhạc giao hưởng.", 
        time: "2 năm", 
        students: "6 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/sangtac_course.mp4" 
    }
];

const COURSE_IMAGE_FALLBACK = {
    guitar: '/static/icons/home_guitar.jpg',
    violin: '/static/icons/home_violin.jpg',
    piano: '/static/icons/home_piano.jpg',
    drum: '/static/icons/home_drum.jpg',
    flute: '/static/icons/home_flute.jpg',
    ukulele: '/static/icons/home_ukulele.jpg',
    organ: '/static/icons/home_organs.jpg',
    'ca hát': '/static/icons/home_vocals.jpg',
    'thanh nhạc': '/static/icons/home_vocals.jpg',
    'dân gian': '/static/icons/video_course/chant_course.jpg',
    'nhạc lí': '/static/icons/video_course/nhacli_course.mp4',
    'lịch sử': '/static/icons/video_course/music_history.jpg',
    'xướng âm': '/static/icons/video_course/chant_course.jpg',
    'hòa âm': '/static/icons/video_course/hoam_course.jpg',
    'lí luận': '/static/icons/video_course/sangtac_course.mp4',
};
function getToken() {
    return localStorage.getItem('access_token') || '';
}

function isLoggedIn() {
    const token = getToken();
    if (!token) return false;
    try {
        const p = JSON.parse(atob(token.split('.')[1]));
        return p.exp * 1000 > Date.now();
    } catch {
        return false;
    }
}

function showToast(message, type = 'info') {
    if (window.cartSidebarInstance?.showToast) {
        window.cartSidebarInstance.showToast(
            message,
            type === 'err' ? 'error' : (type === 'ok' ? 'success' : type)
        );
        return;
    }
    alert(message);
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
    };
}

function normalizeText(v) {
    return String(v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function inferCourseImage(item) {
    const key = normalizeText(item?.cat || item?.title || '');
    for (const k of Object.keys(COURSE_IMAGE_FALLBACK)) {
        if (key.includes(normalizeText(k))) return COURSE_IMAGE_FALLBACK[k];
    }
    return '/static/icons/home_guitar.jpg';
}

async function fetchProductsCatalog() {
    if (PRODUCT_CATALOG_CACHE.length) return PRODUCT_CATALOG_CACHE;
    const endpoints = [
        `${API_BASE}/products/?limit=500`,
        `${API_BASE}/products/products/?limit=500`,
    ];
    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const list = await res.json();
            if (Array.isArray(list) && list.length) {
                PRODUCT_CATALOG_CACHE = list;
                return PRODUCT_CATALOG_CACHE;
            }
        } catch (_) {}
    }
    return [];
}

function findBestProductMatch(course, products) {
    const nTitle = normalizeText(course?.title);
    const nCat = normalizeText(course?.cat);
    const scored = (products || []).map((p) => {
        const pName = normalizeText(p?.name);
        const pCat = normalizeText(p?.cat);
        let score = 0;
        if (!p?.id) return { p, score: -1 };
        if ((p?.product_type || '').toLowerCase() === 'course') score += 6;
        if (pName === nTitle) score += 8;
        if (nTitle && (pName.includes(nTitle) || nTitle.includes(pName))) score += 4;
        if (nCat && (pCat === nCat || pCat.includes(nCat) || nCat.includes(pCat))) score += 3;
        return { p, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].p : null;
}

async function enrollCourse(course) {
    if (!isLoggedIn()) {
        const next = encodeURIComponent('/courses');
        window.location.href = `/login?next=${next}`;
        return;
    }
    let productId = Number(course?.id);
    if (!Number.isFinite(productId)) {
        const products = await fetchProductsCatalog();
        const matched = findBestProductMatch(course, products);
        productId = Number(matched?.id);
    }
    if (!Number.isFinite(productId)) {
        showToast('Khóa học chưa được cấu hình trong hệ thống thanh toán.', 'err');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ product_id: productId, quantity: 1, product_type: 'course' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(data.detail || 'Không thể thêm khóa học vào giỏ hàng', 'err');
            return;
        }
        showToast('Đã thêm khóa học vào giỏ hàng', 'ok');
        if (window.cartSidebarInstance?.fetchFromAPI) {
            await window.cartSidebarInstance.fetchFromAPI();
            window.cartSidebarInstance.updateBadge();
        }
        window.location.href = '/cart';
    } catch (err) {
        console.error('[courses.js] enrollCourse', err);
        showToast('Lỗi kết nối máy chủ', 'err');
    }
}

function renderCourseCard(item, grid) {
    const card = document.createElement('div');
    card.className = 'course-card';

    const mediaSrc = item.video || item.img || inferCourseImage(item);
    const mediaHtml = mediaSrc.endsWith('.mp4')
        ? `<video class="course-media-content" autoplay muted loop playsinline>
            <source src="${mediaSrc}" type="video/mp4">
           </video>`
        : `<img src="${mediaSrc}" alt="${item.title}" class="course-media-content" loading="lazy">`;

    card.innerHTML = `
        <div class="course-media-wrapper">
            ${mediaHtml}
            <span class="course-badge-top">${item.cat || 'Khóa học'}</span>
        </div>
        <div class="course-body">
            <h3>${item.title}</h3>
            <p>${item.desc || ''}</p>
            <div class="course-meta">
                <span><i class="fa-regular fa-clock"></i> ${item.time || 'Đang cập nhật'}</span>
                <span><i class="fa-solid fa-users"></i> ${item.students || 'Đang cập nhật'}</span>
            </div>
            <div class="course-footer">
                <span class="course-rate">
                    ${(Number(item.rate) || 5).toFixed(1)} <i class="fa-solid fa-star" style="color: #f59e0b"></i>
                </span>
                <button class="btn-enroll">Đăng ký ngay</button>
            </div>
        </div>
    `;

    card.querySelector('.btn-enroll')?.addEventListener('click', () => enrollCourse(item));
    grid.appendChild(card);
}

function mapProductToCourse(product) {
    const specs = product?.specs || {};
    return {
        id: product.id,
        cat: product.cat || 'Khóa học',
        title: product.name || 'Khóa học',
        desc: product.description || 'Thông tin khóa học đang được cập nhật.',
        time: specs.duration || specs.time || 'Đang cập nhật',
        students: specs.students || 'Đang cập nhật',
        rate: Number(product.rating || 5),
        video: specs.video || null,
        img: product.image_url || product.img || inferCourseImage(product),
    };
}

async function fetchCoursesFromAPI() {
    const endpoints = [
        `${API_BASE}/products/?limit=500`,
        `${API_BASE}/products/products/?limit=500`,
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const products = await res.json();
            if (!Array.isArray(products)) continue;

            const courses = products
                .filter((p) => {
                    const type = (p?.product_type || '').toLowerCase();
                    if (type === 'course') return true;
                    const specs = p?.specs || {};
                    return Boolean(specs.duration || specs.time || specs.students);
                })
                .map(mapProductToCourse)
                .filter((c) => Number.isFinite(Number(c.id)));

            if (courses.length) return courses;
        } catch (err) {
            console.warn('[courses.js] fetch courses failed at', url, err);
        }
    }
    return [];
}

document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    try {
        const courses = await fetchCoursesFromAPI();

        if (courses.length) {
            courses.forEach((item) => renderCourseCard(item, grid));
            return;
        }
    } catch (err) {
        console.warn('[courses.js] fallback to static COURSE_LIST', err);
    }

    COURSE_LIST.forEach((item) => renderCourseCard(item, grid));
});