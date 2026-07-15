const { estimatePages } = require('./readingStats');

const PUBLISHERS = [
  'İş Bankası Kültür', 'Can Yayınları', 'Yapı Kredi Yayınları', 'Everest Yayınları',
  'Alfa Yayınları', 'Pegasus Yayınları', 'ODTÜ Yayınları', 'Seçkin Yayıncılık',
  'Pelikan Yayıncılık', 'Altın Kitaplar', 'Timaş Yayınları', 'Metis Yayınları',
  'İletişim Yayınları', 'Remzi Kitabevi', 'Doğan Kitap', 'Kronik Kitap',
];

const SHELF_PREFIX = {
  Roman: 'A', 'Bilim Kurgu': 'B', Tarih: 'C', Bilgisayar: 'D', Yazılım: 'D',
  Felsefe: 'E', Psikoloji: 'F', Ekonomi: 'G', Biyografi: 'H', Şiir: 'I',
  'Çocuk Edebiyatı': 'J', Polisiye: 'K', Fantastik: 'L', Bilim: 'M',
  Sanat: 'N', Sosyoloji: 'O', Politika: 'P', 'Din ve Mitoloji': 'Q',
  Eğitim: 'R', Sağlık: 'S', Mühendislik: 'T', Hukuk: 'U', Coğrafya: 'V',
};

const CATALOG = [
  {
    kategori: 'Roman',
    kitaplar: [
      ['Suç ve Ceza', 'Fyodor Dostoyevski'], ['Karamazov Kardeşler', 'Fyodor Dostoyevski'],
      ['Budala', 'Fyodor Dostoyevski'], ['Yeraltından Notlar', 'Fyodor Dostoyevski'],
      ['Savaş ve Barış', 'Lev Tolstoy'], ['Anna Karenina', 'Lev Tolstoy'],
      ['Sefiller', 'Victor Hugo'], ['Notre Dame\'ın Kamburu', 'Victor Hugo'],
      ['Madame Bovary', 'Gustave Flaubert'], ['Don Kişot', 'Miguel de Cervantes'],
      ['Ulysses', 'James Joyce'], ['Dublinliler', 'James Joyce'],
      ['Gurur ve Önyargı', 'Jane Austen'], ['Aşk ve Gurur', 'Jane Austen'],
      ['Jane Eyre', 'Charlotte Brontë'], ['Uğultulu Tepeler', 'Emily Brontë'],
      ['Moby Dick', 'Herman Melville'], ['Bülbülü Öldürmek', 'Harper Lee'],
      ['Fareler ve İnsanlar', 'John Steinbeck'], ['Gazap Üzümleri', 'John Steinbeck'],
      ['Yüzüklerin Efendisi', 'J.R.R. Tolkien'], ['Hobbit', 'J.R.R. Tolkien'],
      ['Silmarillion', 'J.R.R. Tolkien'], ['Harry Potter ve Felsefe Taşı', 'J.K. Rowling'],
      ['Harry Potter ve Sırlar Odası', 'J.K. Rowling'], ['Harry Potter ve Azkaban Tutsağı', 'J.K. Rowling'],
      ['Simyacı', 'Paulo Coelho'], ['Brida', 'Paulo Coelho'], ['On Bir Dakika', 'Paulo Coelho'],
      ['Kürk Mantolu Madonna', 'Sabahattin Ali'], ['İçimizdeki Şeytan', 'Sabahattin Ali'],
      ['Kuyucaklı Yusuf', 'Sabahattin Ali'], ['Yabancı', 'Albert Camus'],
      ['Veba', 'Albert Camus'], ['Düşüş', 'Albert Camus'], ['Satranç', 'Stefan Zweig'],
      ['Olağanüstü Bir Gece', 'Stefan Zweig'], ['Dönüşüm', 'Franz Kafka'],
      ['Dava', 'Franz Kafka'], ['Şato', 'Franz Kafka'], ['Genç Werther\'in Acıları', 'Johann Wolfgang von Goethe'],
      ['Faust', 'Johann Wolfgang von Goethe'], ['Monte Cristo Kontu', 'Alexandre Dumas'],
      ['Üç Silahşörler', 'Alexandre Dumas'], ['İki Şehrin Hikayesi', 'Charles Dickens'],
      ['Oliver Twist', 'Charles Dickens'], ['David Copperfield', 'Charles Dickens'],
      ['Beyaz Diş', 'Jack London'], ['Vahşetin Çağrısı', 'Jack London'],
      ['Deniz Kurtları', 'Jack London'], ['Martı', 'Richard Bach'],
      ['Çalıkuşu', 'Reşat Nuri Güntekin'], ['Yaprak Dökümü', 'Reşat Nuri Güntekin'],
      ['Acımak', 'Reşat Nuri Güntekin'], ['Tutunamayanlar', 'Oğuz Atay'],
      ['Tehlikeli Oyunlar', 'Oğuz Atay'], ['Korkuyu Beklerken', 'Oğuz Atay'],
      ['Saatleri Ayarlama Enstitüsü', 'Ahmet Hamdi Tanpınar'], ['Huzur', 'Ahmet Hamdi Tanpınar'],
      ['Aylak Adam', 'Yusuf Atılgan'], ['Anayurt Oteli', 'Yusuf Atılgan'],
      ['Aşk', 'Elif Şafak'], ['İskender', 'Elif Şafak'], ['Şemspare', 'Elif Şafak'],
      ['Kara Kitap', 'Orhan Pamuk'], ['Benim Adım Kırmızı', 'Orhan Pamuk'],
      ['Kar', 'Orhan Pamuk'], ['Masumiyet Müzesi', 'Orhan Pamuk'],
      ['Serenad', 'Zülfü Livaneli'], ['Mutluluk', 'Zülfü Livaneli'],
      ['Leyla\'nın Evi', 'Zülfü Livaneli'], ['İstanbul Hatırası', 'Ahmet Ümit'],
      ['Sis ve Gece', 'Ahmet Ümit'], ['Patasana', 'Ahmet Ümit'],
    ],
  },
  {
    kategori: 'Bilim Kurgu',
    kitaplar: [
      ['1984', 'George Orwell'], ['Hayvan Çiftliği', 'George Orwell'],
      ['Brave New World', 'Aldous Huxley'], ['Fahrenheit 451', 'Ray Bradbury'],
      ['Martian Chronicles', 'Ray Bradbury'], ['Dune', 'Frank Herbert'],
      ['Çocukluk Sonu', 'Arthur C. Clarke'], ['2001: Uzay Yolu Macerası', 'Arthur C. Clarke'],
      ['Vakıf', 'Isaac Asimov'], ['Vakıf ve İmparatorluk', 'Isaac Asimov'],
      ['Ben Robot', 'Isaac Asimov'], ['Zaman Makinesi', 'H.G. Wells'],
      ['Görünmez Adam', 'H.G. Wells'], ['Ender\'in Oyunu', 'Orson Scott Card'],
      ['Akıcılar', 'Margaret Atwood'], ['Oryx ve Crake', 'Margaret Atwood'],
      ['Neuromancer', 'William Gibson'], ['Blade Runner', 'Philip K. Dick'],
      ['Ubik', 'Philip K. Dick'], ['Yüksek Kale', 'Philip K. Dick'],
      ['Solucan Deliği', 'Carl Sagan'], ['İletişim', 'Carl Sagan'],
      ['Hazır Oyuncu Bir', 'Ernest Cline'], ['Matrix', 'Wachowski Kardeşler'],
      ['Uzay Yolu', 'Gene Roddenberry'], ['Star Wars: Yeni Umut', 'George Lucas'],
    ],
  },
  {
    kategori: 'Tarih',
    kitaplar: [
      ['Sapiens', 'Yuval Noah Harari'], ['Homo Deus', 'Yuval Noah Harari'],
      ['21. Yüzyıl İçin 21 Ders', 'Yuval Noah Harari'], ['Osmanlı Tarihi', 'Halil İnalcık'],
      ['Devlet-i Aliyye', 'Halil İnalcık'], ['Türkiye Tarihi', 'İlber Ortaylı'],
      ['Osmanlı\'yı Yeniden Keşfetmek', 'İlber Ortaylı'], ['Nutuk', 'Mustafa Kemal Atatürk'],
      ['Çanakkale Cephesi', 'Cevat Ülkü'], ['Kurtuluş Savaşı', 'Sina Akşin'],
      ['Dünya Tarihi', 'E.H. Gombrich'], ['Kısa Dünya Tarihi', 'Ernst Gombrich'],
      ['Roma İmparatorluğu', 'Edward Gibbon'], ['Bizans Tarihi', 'Warren Treadgold'],
      ['İkinci Dünya Savaşı', 'Antony Beevor'], ['Stalingrad', 'Antony Beevor'],
      ['Berlin', 'Antony Beevor'], ['Gallipoli', 'Peter Hart'],
      ['Tarih Boyunca Ekonomi', 'David Landes'], ['Silk Roads', 'Peter Frankopan'],
      ['Cengiz Han', 'Jack Weatherford'], ['Selçuklular', 'Claude Cahen'],
    ],
  },
  {
    kategori: 'Bilgisayar',
    kitaplar: [
      ['Algoritmalar', 'Thomas H. Cormen'], ['Introduction to Algorithms', 'Thomas H. Cormen'],
      ['Veri Yapıları ve Algoritma Analizi', 'Mark Allen Weiss'],
      ['Computer Networks', 'Andrew S. Tanenbaum'], ['Modern Operating Systems', 'Andrew S. Tanenbaum'],
      ['Computer Organization', 'David A. Patterson'], ['Mikroişlemciler', 'Barry B. Brey'],
      ['Yapay Zeka', 'Stuart Russell'], ['Artificial Intelligence', 'Stuart Russell'],
      ['Pattern Recognition', 'Christopher Bishop'], ['Deep Learning', 'Ian Goodfellow'],
      ['Database System Concepts', 'Abraham Silberschatz'], ['Veritabanı Sistemleri', 'Ramez Elmasri'],
      ['Compilers', 'Alfred Aho'], ['Computer Architecture', 'John L. Hennessy'],
      ['Discrete Mathematics', 'Kenneth Rosen'], ['Ayrık Matematik', 'Kenneth Rosen'],
      ['Bilgisayar Ağları', 'James F. Kurose'], ['İşletim Sistemleri', 'William Stallings'],
      ['Bilgisayar Mimarisi', 'William Stallings'], ['Cryptography', 'Bruce Schneier'],
    ],
  },
  {
    kategori: 'Yazılım',
    kitaplar: [
      ['Temiz Kod', 'Robert C. Martin'], ['Clean Architecture', 'Robert C. Martin'],
      ['Agile Software Development', 'Robert C. Martin'], ['Refactoring', 'Martin Fowler'],
      ['Domain-Driven Design', 'Eric Evans'], ['Design Patterns', 'Gang of Four'],
      ['Head First Java', 'Kathy Sierra'], ['Effective Java', 'Joshua Bloch'],
      ['JavaScript: The Good Parts', 'Douglas Crockford'], ['You Don\'t Know JS', 'Kyle Simpson'],
      ['Python Crash Course', 'Eric Matthes'], ['Fluent Python', 'Luciano Ramalho'],
      ['The Pragmatic Programmer', 'David Thomas'], ['Code Complete', 'Steve McConnell'],
      ['The Mythical Man-Month', 'Frederick Brooks'], ['Soft Skills', 'John Sonmez'],
      ['Cracking the Coding Interview', 'Gayle Laakmann'], ['System Design Interview', 'Alex Xu'],
      ['React Design Patterns', 'Carlos Santana'], ['Node.js Design Patterns', 'Mario Casciaro'],
    ],
  },
  {
    kategori: 'Felsefe',
    kitaplar: [
      ['Devlet', 'Platon'], ['Sokrates\'in Savunması', 'Platon'], ['Nikomakhos\'a Etik', 'Aristoteles'],
      ['Metafizik', 'Aristoteles'], ['Varlık ve Hiçlik', 'Jean-Paul Sartre'],
      ['Bulantı', 'Jean-Paul Sartre'], ['Şimdinin Gücü', 'Eckhart Tolle'],
      ['Böyle Buyurdu Zerdüşt', 'Friedrich Nietzsche'], ['İyinin ve Kötünün Ötesinde', 'Friedrich Nietzsche'],
      ['Ecce Homo', 'Friedrich Nietzsche'], ['Kritik Saf Aklın Eleştirisi', 'Immanuel Kant'],
      ['Saf Aklın Sınırları', 'Immanuel Kant'], ['Düşünce Hızında', 'Daniel Kahneman'],
      ['Felsefe Tarihi', 'Bertrand Russell'], ['Batı Felsefesi Tarihi', 'Bertrand Russell'],
      ['Sofie\'nin Dünyası', 'Jostein Gaarder'], ['Dünya Felsefe Tarihi', 'Will Durant'],
      ['Meditasyonlar', 'Marcus Aurelius'], ['Sokrates', 'Paul Johnson'],
    ],
  },
  {
    kategori: 'Psikoloji',
    kitaplar: [
      ['İnsanın Anlam Arayışı', 'Viktor Frankl'], ['Psikanaliz ve Din', 'Viktor Frankl'],
      ['Davranışın Yönetimi', 'B.F. Skinner'], ['Bilişsel Davranışçı Terapi', 'Aaron Beck'],
      ['Oyunlar Hakkında', 'Eric Berne'], ['Beden Dili', 'Allan Pease'],
      ['İkna Psikolojisi', 'Robert Cialdini'], ['Etkileme Psikolojisi', 'Robert Cialdini'],
      ['Duygusal Zeka', 'Daniel Goleman'], ['Sosyal Zeka', 'Daniel Goleman'],
      ['Flow', 'Mihaly Csikszentmihalyi'], ['Yaratıcılık', 'Mihaly Csikszentmihalyi'],
      ['Maslow ve Motivasyon', 'Abraham Maslow'], ['Jung ve Arketipler', 'Carl Jung'],
      ['Freud ve Rüyalar', 'Sigmund Freud'], ['Psikanaliz', 'Sigmund Freud'],
      ['Mindset', 'Carol Dweck'], ['Grit', 'Angela Duckworth'],
    ],
  },
  {
    kategori: 'Ekonomi',
    kitaplar: [
      ['Wealth of Nations', 'Adam Smith'], ['Kapital', 'Karl Marx'],
      ['Keynes ve Genel Teori', 'John Maynard Keynes'], ['Freakonomics', 'Steven Levitt'],
      ['Outliers', 'Malcolm Gladwell'], ['Sıfırdan Bire', 'Peter Thiel'],
      ['Zengin Baba Yoksul Baba', 'Robert Kiyosaki'], ['Paranın Psikolojisi', 'Morgan Housel'],
      ['Akıllı Yatırımcı', 'Benjamin Graham'], ['Borsada Rastgele Seyir', 'Burton Malkiel'],
      ['Microeconomics', 'Gregory Mankiw'], ['Macroeconomics', 'Gregory Mankiw'],
      ['Türkiye Ekonomisi', 'Ziya Öniş'], ['Kalkınma Ekonomisi', 'Michael Todaro'],
      ['Dünya Düzeni', 'Henry Kissinger'], ['Globalization', 'Joseph Stiglitz'],
    ],
  },
  {
    kategori: 'Polisiye',
    kitaplar: [
      ['Sherlock Holmes Serisi', 'Arthur Conan Doyle'], ['Hound of the Baskervilles', 'Arthur Conan Doyle'],
      ['Murder on the Orient Express', 'Agatha Christie'], ['And Then There Were None', 'Agatha Christie'],
      ['Görevimiz Tehlike', 'Agatha Christie'], ['Girl with the Dragon Tattoo', 'Stieg Larsson'],
      ['Da Vinci Şifresi', 'Dan Brown'], ['Melekler ve Şeytanlar', 'Dan Brown'],
      ['Kayıp Sembol', 'Dan Brown'], ['Kara Delik', 'Ahmet Ümit'],
      ['Sis ve Gece', 'Ahmet Ümit'], ['Kardeşimin Hikayesi', 'Zülfü Livaneli'],
      ['Gün Olur Asra Bedel', 'Celil Oker'], ['Kırmızı Pelerin', 'Jo Nesbø'],
      ['The Snowman', 'Jo Nesbø'], ['Gone Girl', 'Gillian Flynn'],
    ],
  },
  {
    kategori: 'Fantastik',
    kitaplar: [
      ['Narnia Günlükleri', 'C.S. Lewis'], ['Aslan, Cadı ve Dolap', 'C.S. Lewis'],
      ['Eragon', 'Christopher Paolini'], ['Eldest', 'Christopher Paolini'],
      ['Game of Thrones', 'George R.R. Martin'], ['Clash of Kings', 'George R.R. Martin'],
      ['Storm of Swords', 'George R.R. Martin'], ['Witcher: Son Dilek', 'Andrzej Sapkowski'],
      ['Witcher: Kader Kılıcı', 'Andrzej Sapkowski'], ['Percy Jackson', 'Rick Riordan'],
      ['Artemis Fowl', 'Eoin Colfer'], ['His Dark Materials', 'Philip Pullman'],
      ['Kuzey Işıkları', 'Philip Pullman'], ['Mistborn', 'Brandon Sanderson'],
      ['Way of Kings', 'Brandon Sanderson'], ['Name of the Wind', 'Patrick Rothfuss'],
    ],
  },
  {
    kategori: 'Bilim',
    kitaplar: [
      ['Kozmos', 'Carl Sagan'], ['Pale Blue Dot', 'Carl Sagan'],
      ['Brief History of Time', 'Stephen Hawking'], ['Grand Design', 'Stephen Hawking'],
      ['Origin of Species', 'Charles Darwin'], ['Görelilik', 'Albert Einstein'],
      ['Fizik ve Evren', 'Lawrence Krauss'], ['Parallel Worlds', 'Michio Kaku'],
      ['Hyperspace', 'Michio Kaku'], ['Sapiens Bilimi', 'Richard Dawkins'],
      ['Selfish Gene', 'Richard Dawkins'], ['God Delusion', 'Richard Dawkins'],
      ['Surenin Kısa Tarihi', 'Stephen Jay Gould'], ['Popüler Bilim', 'Asım Kocabıyık'],
      ['Evrim', 'Neil Shubin'], ['Genom', 'Matt Ridley'],
    ],
  },
  {
    kategori: 'Biyografi',
    kitaplar: [
      ['Steve Jobs', 'Walter Isaacson'], ['Einstein', 'Walter Isaacson'],
      ['Benjamin Franklin', 'Walter Isaacson'], ['Leonardo da Vinci', 'Walter Isaacson'],
      ['Atatürk', 'Andrew Mango'], ['Atatürk\'ün Bütün Eserleri', 'Mustafa Kemal Atatürk'],
      ['Napolyon', 'Andrew Roberts'], ['Churchill', 'Andrew Roberts'],
      ['Gandhi', 'Louis Fischer'], ['Mandela', 'Nelson Mandela'],
      ['Long Walk to Freedom', 'Nelson Mandela'], ['Nikola Tesla', 'W. Bernard Carlson'],
      ['Elon Musk', 'Ashlee Vance'], ['Sam Walton', 'Sam Walton'],
    ],
  },
  {
    kategori: 'Sosyoloji',
    kitaplar: [
      ['Kapitalist Toplum', 'Max Weber'], ['Protestan Ahlakı', 'Max Weber'],
      ['Toplumsal Sözleşme', 'Jean-Jacques Rousseau'], ['Emile', 'Jean-Jacques Rousseau'],
      ['Suicide', 'Émile Durkheim'], ['Sosyolojik Yöntem', 'Émile Durkheim'],
      ['Democracy in America', 'Alexis de Tocqueville'], ['Giddens Sosyoloji', 'Anthony Giddens'],
      ['Türkiye\'de Toplum ve Siyaset', 'Şerif Mardin'], ['Modernleşme', 'Bernard Lewis'],
      ['Orientalism', 'Edward Said'], ['Kültür ve Emperyalizm', 'Edward Said'],
    ],
  },
  {
    kategori: 'Sanat',
    kitaplar: [
      ['Sanatın Öyküsü', 'E.H. Gombrich'], ['Story of Art', 'E.H. Gombrich'],
      ['Ways of Seeing', 'John Berger'], ['Camera Lucida', 'Roland Barthes'],
      ['Güzel Sanatlar', 'Leonardo da Vinci'], ['Sanat ve Yaratıcılık', 'Mihaly Csikszentmihalyi'],
      ['Müzik Felsefesi', 'Theodor Adorno'], ['Sinema ve Anlam', 'André Bazin'],
      ['Fotoğraf Üzerine', 'Susan Sontag'], ['Resim Sanatı', 'Ernst Gombrich'],
    ],
  },
  {
    kategori: 'Eğitim',
    kitaplar: [
      ['Pedagoji', 'Jean Piaget'], ['Çocuk ve Öğrenme', 'Maria Montessori'],
      ['Democracy and Education', 'John Dewey'], ['Experience and Education', 'John Dewey'],
      ['Öğrenmenin Özgürlüğü', 'Paulo Freire'], ['Pedagogy of the Oppressed', 'Paulo Freire'],
      ['Mindstorms', 'Seymour Papert'], ['Eğitimde Devrim', 'Ken Robinson'],
      ['Creative Schools', 'Ken Robinson'], ['Öğretmenlik Sanatı', 'Haim Ginott'],
    ],
  },
  {
    kategori: 'Mühendislik',
    kitaplar: [
      ['Mühendislik Mekaniği', 'Russell Hibbeler'], ['Statik', 'Russell Hibbeler'],
      ['Dinamik', 'Russell Hibbeler'], ['Termodinamik', 'Yunus Çengel'],
      ['Akışkanlar Mekaniği', 'Yunus Çengel'], ['Elektrik Devreleri', 'James W. Nilsson'],
      ['Elektronik Devreler', 'Robert Boylestad'], ['Sinyaller ve Sistemler', 'Alan Oppenheim'],
      ['Kontrol Sistemleri', 'Katsuhiko Ogata'], ['Malzeme Bilimi', 'William Callister'],
    ],
  },
];

function generateBooks() {
  const books = [];
  let isbnCounter = 1000001;
  const shelfCounters = {};

  CATALOG.forEach((group) => {
    const prefix = SHELF_PREFIX[group.kategori] || 'X';
    if (!shelfCounters[prefix]) shelfCounters[prefix] = 1;

    group.kitaplar.forEach(([ad, yazar], idx) => {
      const basimYili = 2010 + (isbnCounter % 15);
      const yayinevi = PUBLISHERS[isbnCounter % PUBLISHERS.length];
      const rafNo = `${prefix}-${String(shelfCounters[prefix]).padStart(2, '0')}`;
      const stok = 1 + (isbnCounter % 5);
      const isbn = `978605${String(isbnCounter).padStart(7, '0')}`;

      books.push({
        ad,
        yazar,
        kategori: group.kategori,
        isbn,
        yayinevi,
        basim_yili: basimYili,
        raf_no: rafNo,
        sayfa_sayisi: estimatePages(group.kategori, isbnCounter),
        stok,
        durum: 'mevcut',
      });

      if (idx % 3 === 2) shelfCounters[prefix]++;
      isbnCounter++;
    });
  });

  return books;
}

function seedBooks(db, { force = false } = {}) {
  const count = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  if (!force && count >= 200) {
    console.log(`Kitap zaten mevcut (${count} adet), seed atlandı.`);
    return count;
  }

  if (force) {
    db.prepare('DELETE FROM books').run();
  }

  const books = generateBooks();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO books (ad, yazar, kategori, isbn, yayinevi, basim_yili, raf_no, sayfa_sayisi, stok, durum)
    VALUES (@ad, @yazar, @kategori, @isbn, @yayinevi, @basim_yili, @raf_no, @sayfa_sayisi, @stok, @durum)
  `);

  const insertMany = db.transaction((items) => {
    items.forEach((book) => insert.run(book));
  });

  insertMany(books);
  const newCount = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
  console.log(`${books.length} kitap eklendi. Toplam: ${newCount}`);
  return newCount;
}

module.exports = { generateBooks, seedBooks, CATALOG };
