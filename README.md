# Avukat Dosya İndirici

UYAP avukat portalındaki vekaletinizin bulunduğu dosya evraklarını toplu ve filtreli şekilde lokal olarak indiren Chrome uzantısı.

## Özellikler

- UYAP avukat portalında (`avukat.uyap.gov.tr`) vekaletiniz bulunan dosyalardaki evrakları tespit eder
- Evrakları toplu (birden fazla dosyayı tek seferde) indirir
- Filtreleme desteği ile yalnızca istediğiniz evrak türlerini seçebilirsiniz
- Kesintiye uğrayan indirme işlemlerine kaldığı yerden devam edebilir
- İndirme sırasında oluşabilecek hatalar için rapor sunar
- Tüm veriler yalnızca kendi bilgisayarınıza iner; hiçbir üçüncü taraf sunucuya veri gönderilmez

## Gereksinimler

- Google Chrome (sürüm 111 veya üzeri)
- UYAP Avukat Portalı üzerinde aktif, vekaleti olan bir kullanıcı hesabı

## Kurulum

Bu uzantı şu an Chrome Web Mağazası'nda yayınlanmamıştır; "paketlenmemiş öğe" (unpacked extension) olarak manuel kurulum gerektirir.

### Adım Adım Kurulum

1. Bu depodaki tüm dosyaları bilgisayarınıza indirin:
   - Sayfanın üstündeki yeşil **"Code"** butonuna tıklayın
   - **"Download ZIP"** seçeneğini seçin
   - İndirilen ZIP dosyasını bir klasöre çıkarın (örneğin Masaüstü'nde yeni bir klasöre)

2. Google Chrome'u açın

3. Adres çubuğuna şunu yazın ve Enter'a basın:
   ```
   chrome://extensions
   ```

4. Sayfanın sağ üst köşesinde bulunan **"Geliştirici modu"** (Developer mode) anahtarını açın

5. Sol üstte beliren **"Paketlenmemiş öğe yükle"** (Load unpacked) butonuna tıklayın

6. 1. adımda çıkardığınız klasörü seçin

7. Uzantı listeye eklenecektir. Chrome araç çubuğundaki uzantılar (yapboz parçası) ikonuna tıklayıp uzantıyı sabitleyebilirsiniz

## Kullanım

1. [avukat.uyap.gov.tr](https://avukat.uyap.gov.tr) adresine gidip kendi hesabınızla giriş yapın
2. Vekaletiniz bulunan bir dosyanın evrak listesi sayfasına gidin
3. Chrome araç çubuğunda uzantı ikonuna tıklayarak açılan pencereden indirme işlemini başlatın

## Sorun Bildirimi

Herhangi bir hata veya beklenmeyen davranışla karşılaşırsanız, bu depoda bir "Issue" açarak bildirebilirsiniz. Mümkünse şu bilgileri ekleyin:
- Ne yapmaya çalışıyordunuz
- Ne beklediniz
- Ne oldu (varsa hata mesajı veya ekran görüntüsü)

## Lisans ve Sorumluluk Reddi

Bu araç, resmi bir UYAP ürünü değildir; bağımsız olarak geliştirilmiş, kullanıcıların kendi vekaletleri dahilindeki evrakları indirme işlemini kolaylaştırmayı amaçlayan bir yardımcı araçtır. Kullanımı kullanıcının kendi sorumluluğundadır.
Av.Bayram Can ÇAPAR tarafından kodlanmıştır. 
