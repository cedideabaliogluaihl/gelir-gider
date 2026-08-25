# Gelir-Gider V2.0 — Firebase ortak veri sürümü

Bu sürüm mevcut Gelir-Gider V1.8 yapısını korur; verileri `localStorage` yerine Firebase Firestore'da kullanıcı hesabına bağlar.

## Ne değişti?
- PC ve telefon aynı Google hesabıyla giriş yaptığında aynı işlemleri görür.
- İlk giriş yapılan cihazdaki mevcut `gelirGiderV4` ve `gelirGiderSettingsV1` verileri Firebase'e aktarılır.
- Sonraki cihazlarda Firebase verisi yüklenir.
- Raporlar, düzenleme butonu ve kategoriler Firebase'deki aynı veriyi kullanır.
- Kredi kartı taksitleri de ortak veriden hesaplanır.
- `yokama` Firebase projesine hiçbir bağlantı yapılmaz.

## Firebase Console'da bir kez yapılacaklar

### 1. Google ile giriş aç
Firebase Console → **Authentication** → **Sign-in method** → **Google** → Etkinleştir.

### 2. GitHub Pages alan adını yetkilendir
Authentication → **Settings / Authorized domains** bölümüne şunu ekle:

`cedideabaliogluaihl.github.io`

### 3. Firestore kuralları
Firestore → **Kurallar** bölümüne `firestore.rules` dosyasındaki kuralları koy ve yayınla.

Kurallar yalnızca giriş yapan kullanıcının kendi `users/{uid}` belgesini okuyup yazmasına izin verir.

## GitHub Pages'e yükleme
ZIP içindeki dosyaların tamamını mevcut `gelir-gider` repository'sinin ana dizinine yükle ve commit et.

## İlk kullanım
1. PC'de uygulamayı aç.
2. Üstteki **Google ile giriş yap** düğmesine bas.
3. Mevcut yerel kayıtların Firebase'e aktarılmasına izin ver.
4. Telefonu aç.
5. Aynı Google hesabıyla giriş yap.
6. PC'deki kayıtlar telefonda görünmelidir.

### Önemli
İlk geçişten önce mevcut PC verilerinin ayrıca `Yedekle` düğmesiyle JSON olarak alınması tavsiye edilir.

Bu sürümde Firebase istemci yapılandırması `firebase-core.js` içindedir. Web Firebase config bilgileri istemci uygulamalarında kullanılmak üzere tasarlanmıştır; Firestore güvenliği kurallarla sağlanır.
