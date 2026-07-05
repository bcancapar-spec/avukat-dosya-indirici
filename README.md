# Avukat Dosya İndirici

UYAP avukat portalındaki vekaletinizin bulunduğu dosya evraklarını toplu ve filtreli şekilde lokal olarak indiren Chrome uzantısıdır. 05/07/2026 tarihinde yayına alınmıştır. Geliştirilmeye devam etmektedir. İş yükü azaltmakta, vekaletiniz olan dava dosyalarınızın bir fotokopisini fiziken almak yerine sisteminize kaydetmenize ve üzerinde çalışmanıza imkan sağlamayı amaçlamaktadır. 

## Özellikler
- Kullanım Ücretsizdir. Hak arama hürriyetinin vücut bulmuş hali olan tüm avukatlara adanmıştır. 
- UYAP avukat portalında avukatlık kanunun verdiği yetkiye dayanarak vekili/müdafisi/temsilcisi olduğunuz (`avukat.uyap.gov.tr`) vekaletiniz bulunan dosyalardaki evrakları tespit eder
- Evrakları toplu (birden fazla dosyayı tek seferde) veya tek tek indirir
- Filtreleme desteği ile yalnızca istediğiniz evrak türlerini seçebilirsiniz
- Kesintiye uğrayan indirme işlemlerine kaldığı yerden devam edebilir
- İndirme sırasında oluşabilecek hatalar için rapor sunar
- Tüm veriler yalnızca kendi bilgisayarınıza iner; hiçbir üçüncü taraf sunucuya veri gönderilmez
- İndirilemeyen evrakların listesini sunar. Bu da manuel farkındalık için kullanıcıya kolaylık sağlar. (İlk testlere göre yalnızca vekalet pulu makbuzları indirilememektedir.Bu evrakın barolar birliğinden temin edilen bağımsız bir evrak olduğu tahmin edilmektedir)

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

6. Bu repoyu indirdiğiniz ve zip/rar dosyasını çıkardığınız klasörü seçin ve onaylayın

7. Uzantı listeye eklenecektir. Chrome araç çubuğundaki uzantılar (yapboz parçası) ikonuna tıklayıp uzantıyı sabitleyebilirsiniz

## Kullanım

1. [avukat.uyap.gov.tr](https://avukat.uyap.gov.tr) adresine gidip kendi hesabınızla giriş yapın
2. Vekaletiniz bulunan bir dosyaya bağlanın,  evrak sekmesine tıklayın ardından
4. Chrome araç/eklenti  çubuğunda uzantı ikonuna tıklayarak açılan pencereden indirme işlemini başlatın
5. program bilgisayarınızın indirilenler klasöründe uyap-evraklar klasörü oluşturacak ve indirdiğiniz davanızın alt klasörünü künyeli olarak oluşturacaktır.
6. Künyeli oluşturulan dava dosyanızda en eskiden en yeniye davadaki tüm evraklar numaralandırılarak yüklenecektir.
7. Evraklar bu sürüm itibariyle udf. formatında değil, pdf vd. formatlarda kayıpsız olarak indirilecektir. (ancak indirilen evrakları manuel olarak kontrol etmeyi unutmayınız)

## Sorun Bildirimi

Herhangi bir hata veya beklenmeyen davranışla karşılaşırsanız, bu depoda bir "Issue" açarak veya b.cancapar@gmail.com adresine doğrudan bildirebilirsiniz. Mümkünse şu bilgileri ekleyin:
- Ne yapmaya çalışıyordunuz
- Ne beklediniz
- Ne oldu (varsa hata mesajı veya ekran görüntüsü)

## Lisans ve Sorumluluk Reddi

Bu araç, resmi bir UYAP ürünü değildir; bağımsız olarak geliştirilmiş, kullanıcıların kendi avukatlık genel ve özel vekaletleri dahilindeki yasal yetkisi olan evrakları görme ve indirme işlemini kolaylaştırmayı amaçlayan bir yardımcı araçtır. Kullanımı kullanıcının kendi sorumluluğundadır.
Av.Bayram Can ÇAPAR tarafından kodlanmıştır. 
