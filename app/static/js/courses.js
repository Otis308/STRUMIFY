const COURSE_LIST = [
    { 
        cat: "Guitar", 
        title: "Guitar Cổ điển & Hiện đại", 
        desc: "Kỹ thuật giải thể hình ngón, diễn tấu tác phẩm trung cấp và đệm hát chuyên sâu.", 
        time: "9 tháng", 
        students: "12 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/guitar_course.mp4"  
    },
    { 
        cat: "Violin", 
        title: "Nghệ thuật diễn tấu Violin", 
        desc: "Kỹ thuật kéo vĩ (Bowing), kiểm soát sắc thái và tư thế đứng chuẩn học thuật.", 
        time: "1 năm", 
        students: "10 học viên", 
        rate: 4.8, 
        video: "/static/icons/video_course/violin_course.mp4"
    },
    { 
        cat: "Piano", 
        title: "Piano – Hệ thống kỹ thuật ngón", 
        desc: "Làm chủ phím đàn, lý thuyết âm nhạc và diễn giải tác phẩm đa phong cách.", 
        time: "1 năm", 
        students: "15 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/piano_course.mp4"
    },
    { 
        cat: "Dân gian", 
        title: "Nhạc khí truyền thống Việt Nam", 
        desc: "Nghiên cứu lòng bản và kỹ thuật đặc trưng của đàn Tranh, đàn Bầu chuyên nghiệp.", 
        time: "9 tháng", 
        students: "12 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/harp_course.mp4" 
    },
    { 
        cat: "Drum", 
        title: "Bộ gõ & Tiết tấu chuyên sâu", 
        desc: "Kỹ thuật cầm dùi, phối hợp tứ chi và tư duy giữ nhịp trong dàn nhạc.", 
        time: "6 tháng", 
        students: "10 học viên", 
        rate: 4.9, 
        video: "/static/icons/video_course/drum_course.mp4"
    },
    { 
        cat: "Flute", 
        title: "Sáo Flute & Nghệ thuật hơi thở", 
        desc: "Kỹ thuật khẩu hình, lấy hơi và xử lý sắc thái tinh tế trong hòa tấu.", 
        time: "6 tháng", 
        students: "8 học viên", 
        rate: 4.7, 
        video: "/static/icons/video_course/flute_course.mp4"
 
    },
    { 
        cat: "Ukulele", 
        title: "Ukulele & Nhạc lý ứng dụng", 
        desc: "Hành trình nhập môn nhạc cụ dây và xây dựng nền tảng cảm thụ âm nhạc.", 
        time: "3 tháng", 
        students: "18 học viên", 
        rate: 4.9, 
        video: "/static/icons/video_course/ukulele_course.mp4"
 
    },
    { 
        cat: "Organ", 
        title: "Thủ pháp biểu diễn Keyboard", 
        desc: "Làm chủ các tính năng phức hợp và kỹ năng độc tấu chuyên nghiệp trên Organ.", 
        time: "9 tháng", 
        students: "12 học viên", 
        rate: 4.8, 
        video: "/static/icons/video_course/organ_course.mp4" 
    },
    { 
        cat: "Ca hát", 
        title: "Nghệ thuật Ca hát & Biểu diễn", 
        desc: "Giải phóng hình thể, cải thiện giọng hát và định hình phong cách sân khấu.", 
        time: "6 tháng", 
        students: "20 học viên", 
        rate: 4.6, 
        video: "/static/icons/video_course/vocal_course.mp4"
    },
    { 
        cat: "Thanh nhạc", 
        title: "Thanh nhạc Cổ điển chuyên sâu", 
        desc: "Kỹ thuật cộng minh, nén hơi và xử lý tác phẩm theo chuẩn thính phòng.", 
        time: "1 năm", 
        students: "8 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/thanhnhac_course.mp4" 
    },
    { 
        cat: "Nhạc lí", 
        title: "Lý thuyết âm nhạc tổng quát", 
        desc: "Hệ thống ký hiệu, cấu tạo âm giai và quãng từ cơ bản đến nâng cao.", 
        time: "4 tháng", 
        students: "25 học viên", 
        rate: 4.9, 
        video: "/static/icons/video_course/nhacli_course.mp4" 
    },
    { 
        cat: "Lịch sử", 
        title: "Lịch sử & Phê bình âm nhạc", 
        desc: "Nghiên cứu hành trình âm nhạc từ thời kỳ Phục hưng đến nghệ thuật đương đại.", 
        time: "6 tháng", 
        students: "20 học viên", 
        rate: 4.8, 
        video: "/static/icons/video_course/history_course.mp4" 
    },
    { 
        cat: "Xướng âm", 
        title: "Xướng âm & Huấn luyện thính giác", 
        desc: "Phát triển khả năng nghe nốt, đọc bản nhạc (Sight-reading) và phản xạ tiết tấu.", 
        time: "6 tháng", 
        students: "15 học viên", 
        rate: 4.7, 
        video: "/static/icons/video_course/chant_course.mp4" 
    },
    { 
        cat: "Hòa âm", 
        title: "Hòa âm & Thủ pháp phối khí", 
        desc: "Kỹ thuật sắp xếp nhạc cụ, chuyển động bè và đặt hợp âm cho tác phẩm.", 
        time: "1 năm", 
        students: "10 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/hoam_course.mp4" 
    },
    { 
        cat: "Lí luận", 
        title: "Sáng tác & Chỉ huy dàn nhạc", 
        desc: "Phân tích cấu trúc tác phẩm và kỹ năng điều hành dàn nhạc giao hưởng.", 
        time: "2 năm", 
        students: "6 học viên", 
        rate: 5.0, 
        video: "/static/icons/video_course/sangtac_course.mp4" 
    }
];
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    COURSE_LIST.forEach(item => {
        const card = document.createElement('div');
        card.className = 'course-card';

        // Logic kiểm tra media: Nếu có video thì dùng thẻ video, không thì dùng img
        const mediaHtml = item.video 
            ? `<video class="course-media-content" autoplay muted loop playsinline>
                <source src="${item.video}" type="video/mp4">
               </video>`
            : `<img src="${item.img}" alt="${item.title}" class="course-media-content" loading="lazy">`;

        card.innerHTML = `
            <div class="course-media-wrapper">
                ${mediaHtml}
                <span class="course-badge-top">${item.cat}</span>
            </div>
            <div class="course-body">
                <h3>${item.title}</h3>
                <p>${item.desc}</p>
                <div class="course-meta">
                    <span><i class="fa-regular fa-clock"></i> ${item.time}</span>
                    <span><i class="fa-solid fa-users"></i> ${item.students}</span>
                </div>
                <div class="course-footer">
                    <span class="course-rate">
                        ${item.rate.toFixed(1)} <i class="fa-solid fa-star" style="color: #f59e0b"></i>
                    </span>
                    <button class="btn-enroll">Đăng ký ngay</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
});