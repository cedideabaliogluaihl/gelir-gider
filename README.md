# Gelir-Gider

Mobil uyumlu, sade kişisel gelir-gider takip uygulaması.

### Para mantığı
- Kullanılabilir Para = Gelir - Gider - Kasa Transferi
- Kasada = Kasa Transferi toplamı
- Toplam Varlık = Gelir - Gider

Kasa transferi gider değildir; para sadece kasaya taşınır.

## GitHub Pages
1. Bu dosyaları bir GitHub repository'sine yükle.
2. Settings → Pages.
3. Deploy from branch → `main` → `/root`.
4. Oluşan GitHub Pages adresini telefonda aç.
5. Tarayıcı menüsünden Ana Ekrana Ekle.

## Not
İlk sürüm verileri tarayıcının localStorage alanında tutar. Telefon ve bilgisayar arasında ortak veri için sonraki aşamada Supabase gibi bir bulut veritabanı eklenebilir.
