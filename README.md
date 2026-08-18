# Avukat Dosya İndirici

UYAP **avukat** ve **vatandaş** portallarındaki dosya evraklarını toplu ve filtreli şekilde lokal olarak indiren Chrome uzantısıdır. 05/07/2026 tarihinde yayına alınmıştır. Geliştirilmeye devam etmektedir. İş yükü azaltmakta, vekaletiniz olan dava dosyalarınızın bir fotokopisini fiziken almak yerine sisteminize kaydetmenize ve üzerinde çalışmanıza imkan sağlamayı amaçlamaktadır. 

## Özellikler
- Kullanım Ücretsizdir. Hak arama hürriyetinin vücut bulmuş hali olan tüm avukatlara adanmıştır. 
- UYAP avukat portalında avukatlık kanunun verdiği yetkiye dayanarak vekili/müdafisi/temsilcisi olduğunuz (`avukat.uyap.gov.tr`) vekaletiniz bulunan dosyalardaki evrakları şahsi onayınızla ve kendi log kaydınızla tespit eder
- Evrakları toplu (birden fazla dosyayı tek seferde) veya tek tek indirir
- Filtreleme desteği ile yalnızca istediğiniz evrak türlerini seçebilirsiniz
- Kesintiye uğrayan indirme işlemlerine kaldığı yerden devam edebilir
- İndirme sırasında oluşabilecek hatalar için rapor sunar
- Tüm veriler yalnızca kendi bilgisayarınıza iner; hiçbir üçüncü taraf sunucuya veri gönderilmez
- İndirilemeyen evrakların listesini sunar. Bu da manuel farkındalık için kullanıcıya kolaylık sağlar. (İlk testlere göre yalnızca vekalet pulu makbuzları indirilememektedir.Bu evrakın barolar birliğinden temin edilen bağımsız bir evrak olduğu tahmin edilmektedir)


## Desteklenen Portallar

| Portal | Adres | Evrak listesi kaynağı | İndirme ucu |
|---|---|---|---|
| Avukat | `avukat.uyap.gov.tr` | `list_dosya_evraklar.ajx` cevabı | `view_document_brd.uyap` |
| Vatandaş | `vatandas.uyap.gov.tr` | DOM ağacı (`span[evrak_id]`) | `download_document_brd.uyap` |

### Vatandaş portalı kullanımı

1. `vatandas.uyap.gov.tr` üzerinde oturum açın (giriş, e-imza ve PIN adımları yalnızca size aittir).
2. **Sorgulama İşlemleri → Dosya Sorgulama** ile dosyayı bulup **Dosya Görüntüle**'ye basın.
3. Açılan pencerede **Evrak** sekmesine geçin.
4. Ağaçtaki **Tüm Evraklar** düğümünü genişletin (alt düğümler de açılmalıdır; kapalı düğüm kalırsa o evraklar listeye girmez).
5. Uzantı simgesine tıklayıp **Listele** deyin, ardından indirmeyi başlatın.

> Uzantı `dosyaId` ve `yargiTuru` bilgisini, Evrak sekmesi açılırken giden `dosya_evrak_bilgileri_brd.ajx` isteğinden yakalar. "dosyaId/yargiTuru saptanamadı" hatası alırsanız Evrak sekmesini bir kez kapatıp yeniden açmanız yeterlidir.

### Vatandaş portalında öğrenilen üç ders

Bu üç nokta koda yorum olarak da işlenmiştir (`main-list.js`):

1. **Evrak listesi AJX cevabında değil, DOM'dadır.** Vatandaş portalında `list_dosya_evraklar.ajx` muadili yoktur; evraklar ağaca `span[evrak_id]` olarak basılır.

2. **Ağaç aynı evrağı birden çok kez çizer.** Aynı evrak hem "Dosyaya Eklenen Son 20 Evrak" dalında hem "Tüm Evraklar" altındaki tür klasörlerinde tekrar görünür. Saha ölçümünde **520 benzersiz evrak DOM'a 3094 span** olarak basılmıştı. `evrak_id` ile tekilleştirme yapılmazsa aynı evrak defalarca iner ve sayım şişer.

3. **Önizleme ucundan indirmeyin — sessiz veri kaybı verir.** `view_document_brd.uyap?mimeType=StyleReport&…` önizleme içindir; büyük evraklarda dosya yerine 116 baytlık şu metni döndürür:
   > "Görüntülemek istediğiniz evrakın boyutu çok büyük! Lütfen evrakı sisteminize kaydederek görüntüleyiniz."

   HTTP 200 döndüğü için hata gibi görünmez. Saha ölçümünde 520 evrağın **~%29'u** bu şekilde sessizce kaybolmuştu. Doğrusu, portalın kendi indirme ucu olan `download_document_brd.uyap`'tır: orijinal dosyayı (udf/pdf/tiff) `Content-Disposition` ile birlikte verir, boyut sınırı yoktur.

Ayrıca vatandaş ağacında **ek evraklar** ana evrağın altında yalnızca "Ek 1", "Ek 2" etiketiyle durur; tarih ve anlamlı ad taşımazlar. Uzantı bunları ana evraktan miras aldırır (`Kayyım Raporu - Ek 1`, tarih dahil). Test edilen dosyada 520 evrağın 19'u ana, **501'i ek** evraktı.

## Gereksinimler

- Google Chrome (sürüm 111 veya üzeri)
- UYAP Avukat Portalı (vekaletli dosyalar) veya UYAP Vatandaş Portalı (taraf olduğunuz dosyalar) üzerinde aktif oturum

## Kurulum

Bu uzantı şu an Chrome Web Mağazası'nda yayınlanmamıştır; Geliştirme aşamasındadır. "paketlenmemiş öğe" (unpacked extension) olarak manuel kurulum gerektirir. Kaynak kodlar denetime açık olup işbu repoda açıkça yayınlanmıştır. 

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
6. Künyeli oluşturulan dava dosyanızda/icra dosyanızda en eskiden en yeniye davadaki tüm evraklar numaralandırılarak yüklenecektir.
7. Evraklar bu sürüm itibariyle udf. formatında değil, pdf vd. formatlarda kayıpsız olarak indirilecektir. (ancak indirilen evrakları manuel olarak kontrol etmeyi unutmayınız)

## Sorun Bildirimi

Herhangi bir hata veya beklenmeyen davranışla karşılaşırsanız, bu depoda bir "Issue" açarak veya b.cancapar@gmail.com adresine doğrudan ulaşarak bildirebilirsiniz. Mümkünse şu bilgileri ekleyin:
- Ne yapmaya çalışıyordunuz
- Ne beklediniz
- Ne oldu (varsa hata mesajı veya ekran görüntüsü)

## Lisans ve Sorumluluk Reddi

Bu araç, resmi bir UYAP ürünü değildir; bağımsız olarak geliştirilmiş, kullanıcıların kendi avukatlık genel ve özel vekaletleri dahilindeki yasal yetkisi olan evrakları görme ve indirme işlemini kolaylaştırmayı amaçlayan ticari amacı olmayan açık kaynak kodlu bir yardımcı araçtır.Hiçbir veri üçüncü tarafla paylaşılmamakta ve kod dizaynında fiziksel ve dijital imkan bulunmamaktadır. Kullanıcı eklenti neticesinde vekaleti olan davalara ilişkin elde ettiği veriden 1136 sayılı kanuna göre kendisi bizzat sorumludur. Eklentinin Kullanımı kullanıcının kendi sorumluluğundadır.Kullanıcı işbu eklentiyi kullanmakla tüm sorumluluğun kendine ait olduğunu ve veri güvenliğini bizzat sağladığını bu konuda önlem aldığını açıkça kabul etmiştir. 
Av.Bayram Can ÇAPAR tarafından fikir üretilerek özgün biçimde kodlanmıştır. Fikri Mülkiyet tarafımıza aittir. 5846 sayılı Fikir ve Sanat Eserleri Kanunu kapsamında işlemler için repodaki Lisans belgesine bakınız.  
