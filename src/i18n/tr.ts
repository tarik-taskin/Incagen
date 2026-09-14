export const tr = {
  auth: {
    login: "Giriş yap", register: "Hesap oluştur", logout: "Çıkış yap",
    email: "E-posta", password: "Parola", loading: "Oturum kontrol ediliyor…",
    local: "Yerel geliştirme ortamı — yalnız sentetik veriler kullanın.",
    offline: "Yerel servisle bağlantı kurulamadı. Firebase emülatörlerini başlatın.",
    invalid: "E-posta veya parola geçersiz.", exists: "Bu e-posta zaten kayıtlı.",
    weak: "Parola en az 8 karakter olmalı.", generic: "İşlem tamamlanamadı. Yeniden deneyin.",
  },
  analysis: {
    title: "Verilerinizi analize hazırlayın", reportTitle: "Hesaplanan veri raporu",
    disclaimer: "Hesaplanan veri raporu — AI yorumu henüz eklenmedi",
    titleLabel: "Rapor başlığı", business: "İşletme adı", currency: "Para birimi",
    start: "Rapor oluştur", retry: "Yeniden dene", cancel: "Yüklemeyi iptal et",
    refresh: "Dosyalar sayfalar arasında korunur. Tarayıcıyı yenilerseniz yeniden seçmeniz gerekir.",
    csvOnly: "Bu sürüm yalnız CSV işler. Diğer dosyaları kaldırıp tekrar deneyin.",
    empty: "Önce en az bir CSV dosyası seçin.", deleted: "Analiz ve kaynak dosyaları silindi.",
    delete: "Analizi ve dosyaları sil", confirm: "Analiz ve kaynak dosyaları kalıcı olarak silinsin mi?",
    history: "Geçmiş analizleriniz", noHistory: "Henüz analiziniz yok.",
    total: "Toplam satış", rows: "İşlem satırı", average: "Satır başına ortalama",
  },
  status: {
    draft: "Taslak", uploading: "Dosyalar yükleniyor", processing: "Veriler hesaplanıyor",
    completed: "Tamamlandı", failed: "İşlem başarısız", deleting: "Siliniyor",
  },
} as const;
