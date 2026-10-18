export const tr = {
  auth: {
    login: "Giriş yap", register: "Hesap oluştur", logout: "Çıkış yap",
    email: "E-posta", password: "Parola", loading: "Oturum kontrol ediliyor…",
    offline: "Servisle bağlantı kurulamadı. Lütfen yeniden deneyin.",
    invalid: "E-posta veya parola geçersiz.", exists: "Bu e-posta zaten kayıtlı.",
    weak: "Parola en az 8 karakter olmalı.", generic: "İşlem tamamlanamadı. Yeniden deneyin.",
  },
  analysis: {
    title: "Belgelerinizi analize hazırlayın", reportTitle: "Belge hazırlık özeti",
    disclaimer: "Belge içerikleri ayrıştırıldı — AI yorumu henüz eklenmedi",
    titleLabel: "Analiz başlığı", business: "İşletme adı",
    start: "Belgeleri ayrıştır", retry: "Yeniden dene", cancel: "Yüklemeyi iptal et",
    empty: "Önce en az bir belge ekleyin.", deleted: "Analiz ve kaynak belgeler silindi.",
    delete: "Analizi ve belgeleri sil", confirm: "Analiz ve kaynak belgeler kalıcı olarak silinsin mi?",
    history: "Geçmiş analizleriniz", noHistory: "Henüz analiziniz yok.",
  },
  status: {
    draft: "Taslak", uploading: "Dosyalar yükleniyor", processing: "Veriler hesaplanıyor",
    review: "Onay bekliyor", completed: "Analize hazır", failed: "İşlem başarısız", deleting: "Siliniyor",
  },
} as const;
