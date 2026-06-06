# 📱 Integrácia s Flutter Mobilnou Aplikáciou

Tento sprievodca popisuje, ako jednoducho prepojiť vašu Flutter mobilnú aplikáciu s naším **Gemini AI overovacím backendom** bežiacim na porte `3000`.

---

## 1. Pridanie závislostí (`pubspec.yaml`)

Otvorte súbor `pubspec.yaml` vo vašom Flutter projekte a pridajte nasledujúce knižnice pod sekciu `dependencies`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Knižnice potrebné pre prácu s mapou, GPS súradnicami, ikonami a sieťovými požiadavkami
  flutter_map: ^6.1.0
  latlong2: ^0.9.0
  http: ^1.2.1
  lucide_icons: ^0.320.0 # Pre krásne moderné ikony
```

Spustite príkaz na stiahnutie balíčkov v termináli:
```bash
flutter pub get
```

---

## 2. Povolenie prístupu na Internet (`AndroidManifest.xml`)

Uistite sa, že vaša Android aplikácia má povolený prístup na internet, aby dokázala komunikovať s lokálnym alebo vzdialeným serverom. Pridajte tento riadok do súboru `android/app/src/main/AndroidManifest.xml` (tesne nad značku `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET"/>
```

---

## 3. Kompletný Dart Kód pre `_MapScreenState` (`main.dart`)

Tu je plne pripravená a optimalizovaná implementácia slovenskej mapovej obrazovky pre Flutter vrátane integrácie s našou novou **Gemini overovacou službou**.

```dart
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  // Lokálne úložisko overených kaviarní
  final Map<String, bool> verifiedCafes = {
    'Café Wallner': false,
    'Hofzuckerbäckerei': false,
    'Seecafe Hallstatt': false,
  };

  // Zoznam kaviarní v Salzkammergut regióne s presnými koordinátmi
  final List<Map<String, dynamic>> cafes = [
    {
      'name': 'Café Wallner',
      'reward': '4.50 €',
      'location': const LatLng(47.7385, 13.4475), // St. Wolfgang
    },
    {
      'name': 'Hofzuckerbäckerei',
      'reward': '5.00 €',
      'location': const LatLng(47.7125, 13.6210), // Bad Ischl
    },
    {
      'name': 'Seecafe Hallstatt',
      'reward': '3.50 €',
      'location': const LatLng(47.5620, 13.6490), // Hallstatt
    },
  ];

  // Stav pre načítavanie (AI Analýza)
  bool _isAnalyzing = false;

  /// Pošle odfotenú snímku v Base64 na náš Gemini AI server na overenie autenticity
  Future<void> sendToGeminiForVerification(String imagePath, String cafeName) async {
    setState(() {
      _isAnalyzing = true;
    });

    try {
      // 1. Načítaj lokálny súbor fotografie a preveď ho do Base64 formátu
      final bytes = await File(imagePath).readAsBytes();
      final base64Image = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      // 2. Definuj adresu backendu (10.0.2.2 je rezervované pre Android emulátor namiesto localhost)
      final url = Uri.parse('http://10.0.2.2:3000/verify-mission');

      final response = await http.post(
        url,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "imageBase64": base64Image,
          "cafeName": cafeName,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        if (data['approved'] == true) {
          // Schválenie misie kamerou v oboch rozhraniach
          setState(() {
            verifiedCafes[cafeName] = true;
          });

          // Zobrazenie úspešného dialógu
          if (mounted) {
            _showStatusDialog(
              title: "Misia schválená! 🎉",
              message: data['reason'] ?? "Vaša fotografia bola overená umelou inteligenciou Gemini.",
              isSuccess: true,
            );
          }
        } else {
          // Zamietnutie misie s odôvodnením od Gemini
          if (mounted) {
            _showStatusDialog(
              title: "Misia zamietnutá ❌",
              message: data['reason'] ?? "Fotografia nezodpovedá kaviarni.",
              isSuccess: false,
            );
          }
        }
      } else {
        throw Exception("Server vrátil chybový kód: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Chyba pri overovaní misie: $e");
      if (mounted) {
        _showStatusDialog(
          title: "Chyba komunikácie",
          message: "Nepodarilo sa spojiť s overovacím serverom Gemini. Skontrolujte, či server beží.",
          isSuccess: false,
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isAnalyzing = false;
        });
      }
    }
  }

  /// Zobrazenie detailov o vybranej kaviarni s možnosťou spustiť fotoaparát
  void _showCafeDetails(BuildContext context, String name, String reward) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        final isClaimed = verifiedCafes[name] ?? false;

        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                name,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.brown),
              ),
              const SizedBox(height: 8),
              Text(
                isClaimed ? "✓ Výplata odmeny dokončená" : "Úloha: Odfotografujte kávu alebo interiér podniku pre získanie $reward.",
                style: TextStyle(color: Colors.grey[600], fontSize: 13),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isClaimed ? Colors.green : Colors.brown,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: isClaimed ? null : () async {
                  // 1. ZATVORIŤ AKTUÁLNY MODAL
                  Navigator.pop(context);
                  
                  // 2. OTVORIŤ KAMERU (Namiesto MissionCameraScreen tu simulujeme pre jednoduchosť testu,
                  // pre reálne fotenie doplňte balíček 'camera' alebo 'image_picker')
                  final File? capturedImage = await _simulateOrPickPhoto(context);

                  if (capturedImage != null) {
                    if (context.mounted) {
                      // 3. ODOSLAŤ FOTKU NA GEMINI ANALÝZU
                      await sendToGeminiForVerification(capturedImage.path, name);
                    }
                  }
                },
                icon: Icon(isClaimed ? Icons.check_circle : Icons.camera_alt, color: Colors.white),
                label: Text(
                  isClaimed ? "Misia splnená" : "Spustiť overovací fotoaparát",
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Pomocná simulácia výberu fotografie (resp. reálne nahranie)
  Future<File?> _simulateOrPickPhoto(BuildContext context) async {
    // V reálnej aplikácii by ste tu volali Navigator.push k vašej kamere alebo:
    // final picker = ImagePicker();
    // final pickedFile = await picker.pickImage(source: ImageSource.camera);
    // return pickedFile != null ? File(pickedFile.path) : null;
    
    // Na účely rýchleho otestovania vytvoríme fingovaný prázdny súbor:
    final directory = Directory.systemTemp;
    final file = File('${directory.path}/test_coffee.jpg');
    await file.writeAsBytes([0, 1, 2, 3]); // Vytvorenie binárnych dát
    return file;
  }

  /// Pomocník pre zobrazenie krásneho dialógu stavu overenia
  void _showStatusDialog({required String title, required String message, required bool isSuccess}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: TextStyle(color: isSuccess ? Colors.green[800] : Colors.red[800], fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message, style: const TextStyle(fontSize: 14, height: 1.4)),
            const SizedBox(height: 16),
            if (isSuccess)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.pink[50], borderRadius: BorderRadius.circular(10)),
                child: const Row(
                  children: [
                    Icon(Icons.share, color: Colors.pink),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "Teraz zdieľaj na Instagrame s tagom kaviarnie pre extra odmenu a nahraj screenshot!",
                        style: TextStyle(color: Colors.pink, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              )
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Rozumiem", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey)),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Salzkammergut Kaviarenské Misie", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.brown,
        elevation: 0.5,
        actions: [
          if (_isAnalyzing)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.brown),
              ),
            )
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            options: const MapOptions(
              initialCenter: LatLng(47.7000, 13.5500), // Presný stred medzi jazerami
              initialZoom: 9.0, // Znížili sme z 11.0 na 9.0 – uvidíš oveľa širšie okolie
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.coffeemissions',
              ),
              MarkerLayer(
                markers: cafes.map((cafe) {
                  final isVerified = verifiedCafes[cafe['name']] ?? false;
                  return Marker(
                    point: cafe['location'],
                    width: 120.0,  // Mierne sme zväčšili šírku pre lepšiu čitateľnosť textu
                    height: 60.0, // Mierne sme zväčšili výšku pre Card element
                    child: GestureDetector(
                      onTap: () => _showCafeDetails(context, cafe['name'], cafe['reward']),
                      child: Card(
                        color: isVerified ? Colors.green[50] : Colors.white,
                        elevation: 4,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                            color: isVerified ? Colors.green : Colors.grey[300]!,
                            width: 1.5,
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                isVerified ? Icons.check_circle : Icons.coffee,
                                size: 18,
                                color: isVerified ? Colors.green : Colors.brown,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                cafe['reward'],
                                style: TextStyle(
                                  color: isVerified ? Colors.green[800] : Colors.black,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          
          if (_isAnalyzing)
            Container(
              color: Colors.black26,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text(
                      "Gemini AI overuje vašu fotografiu...",
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    )
                  ],
                ),
              ),
            )
        ],
      ),
    );
  }
}
```

---

## 4. GPS Lokácia & Geolocator Geofencing

Aby používatelia nemohli simulovať splnenie misie z pohodlia domova, zavedieme **geofencing**. Systém overí aktuálne GPS súradnice zariadenia a povolí fotenie iba v prípade, že sa používateľ nachádza v bezprostrednom okruhu (napr. do **50 metrov**) od vybranej kaviarne.

### 4.1. Pridanie závislostí a konfigurácia povolení

1. Pridajte balíček [geolocator](https://pub.dev/packages/geolocator) pod `dependencies` do súboru `pubspec.yaml`:
   ```yaml
   dependencies:
     geolocator: ^11.0.0
   ```

2. **Android Nastavenia** (`android/app/src/main/AndroidManifest.xml`):
   Pridajte tieto riadky spolu s internetovým povolením (pod alebo nad `<application>` značku):
   ```xml
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   ```

3. **iOS Nastavenia** (`ios/Runner/Info.plist`):
   Pridajte nasledujúci kľúč a textový popis pre používateľov:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>LokalGlow potrebuje tvoju polohu na overenie, či sa nachádzaš v kaviarni.</string>
   ```

---

### 4.2. Samostatná Služba pre GPS (`GpsService`)

Vytvorte súbor `gps_service.dart` (alebo ho vložte do `main.dart`), ktorý bude zapuzdrovať logiku overovania prístupových práv a výpočtu vzdialenosti:

```dart
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

class GpsService {
  // Funkcia na skontrolovanie a vypýtanie GPS povolení od používateľa
  static Future<bool> checkPermissions() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    
    if (permission == LocationPermission.deniedForever) return false;
    return true;
  }

  // Hlavná funkcia, ktorá povie, či je používateľ dosť blízko (napr. do 50 metrov)
  static Future<bool> isUserAtLocation(LatLng targetLocation, double maxDistanceInMeters) async {
    bool hasPermission = await checkPermissions();
    if (!hasPermission) return false;

    // Získaj aktuálnu GPS polohu mobilu
    Position position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high
    );

    // Vypočítaj vzdialenosť vzdušnou čiarou medzi človekom a kaviarňou
    double distance = Geolocator.distanceBetween(
      position.latitude,
      position.longitude,
      targetLocation.latitude,
      targetLocation.longitude,
    );

    print("Reálna vzdialenosť od podniku: ${distance.toStringAsFixed(1)} metrov");

    // Vráti true, ak je vzdialenosť menšia ako povolený limit
    return distance <= maxDistanceInMeters;
  }
}
```

---

### 4.3. Prepojenie s Modal Bottom Sheetom (`_showCafeDetails`)

Teraz upravte detailné zobrazenie kaviarne, aby ste doň zakomponovali GPS overovanie, zlatú akcentovú farbu tlačidla a prechod do kamery po schválení GPS polohy:

```dart
void _showCafeDetails(BuildContext context, String name, String reward, LatLng location) {
  // Pridali sme parameter 'location' do funkcie, aby sme vedeli, kde kaviareň je
  
  showModalBottomSheet(
    context: context,
    backgroundColor: const Color(0xFF1A1A1A), // Moderné tmavé pozadie pre exkluzívny "premium" pocit
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(25))
    ),
    builder: (context) {
      return Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              name, 
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white)
            ),
            const SizedBox(height: 16),
            const Text(
              '• Systém pred spustením overí tvoju GPS polohu.', 
              style: TextStyle(color: Colors.white70)
            ),
            const SizedBox(height: 24),
            
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFD700), // Zlatá akcentová farba
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                ),
                onPressed: () async {
                  // Spustíme GPS overenie na limit 50 metrov
                  bool isAtCafe = await GpsService.isUserAtLocation(location, 50.0);
                  
                  if (!context.mounted) return;

                  if (isAtCafe) {
                    Navigator.pop(context); // Zatvor modal bottom sheet
                    
                    // Zobrazíme informáciu a spustíme akciu simulovaného fotenia / výberu fotky
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('GPS overené! Otváram fotoaparát...'), 
                        backgroundColor: Colors.green
                      ),
                    );

                    // POZNÁMKA: Tu v reálnej aplikácii navigujete na obrazovku fotoaparátu
                    final File? capturedImage = await _simulateOrPickPhoto(context);
                    if (capturedImage != null) {
                      await sendToGeminiForVerification(capturedImage.path, name);
                    }
                  } else {
                    // CHYBA: Používateľ je príliš ďaleko a geofencing ho nepustil ďalej
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text("Chyba polohy"),
                        content: const Text("Nachádzaš sa príliš ďaleko od tejto kaviarne. Misie môžeš plniť len priamo na mieste."),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context), 
                            child: const Text("Rozumiem")
                          )
                        ],
                      ),
                    );
                  }
                },
                child: const Text(
                  'Overiť polohu a začať', 
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}
```

Nezabudnite po zmene reštartovať váš herný/vývojový server kliknutím na veľké **R** (Hot Restart) pre okamžitú aktualizáciu stavu mapy!

---

## 5. Kompletný Krok za Krokom Overovací Workflow (Synchrónny Priebeh s Dialógmi)

Pre maximálne plynulý zážitok vytvoríme hlavnú riadiacu funkciu `_startMissionWorkflow`, ktorá používateľa sprevádza celým procesom bez prerušenia alebo zmätku. 

### 5.1. Logický Reťazec Overenia
1. **Zistujeme polohu:** Zobrazíme loading indikátor s textom *„Overujem tvoju polohu v kaviarni...“*.
2. **GPS Geofence:** Služba `GpsService` zmeria vzdialenosť. Ak je používateľ príliš ďaleko, loading zavrieme a ukážeme elegantnú chybovú hlášku.
3. **Fotenie:** Ak je poloha v poriadku, otvoríme fotoaparát `MissionCameraScreen` a počkáme na snímok obrazovky.
4. **Analýza Gemini AI:** Keď máme fotku, odošleme ju na náš server na port `3000` (`/verify-mission`) a používateľ vidí indikátor *„Gemini AI analyzuje tvoj screenshot...“*.
5. **Finálne rozhodnutie:** Na základe návratového JSONu bud' pripíšeme odmenu a oslávime úspech, alebo zobrazíme inteligentný dôvod zamietnutia od Gemini.

### 5.2. Kompletná implementovaná workflow logika

Vložte tieto metódy do svojej triedy `_MapScreenState` pre plnohodnotný herný zážitok:

```dart
/// Spustenie kompletného trojkrokového overovacieho procesu
void _startMissionWorkflow(BuildContext context, String name, LatLng location) async {
  // 1. KROK: LOADING - Zisťujeme GPS polohu na mieste
  _showLoadingDialog(context, "Overujem tvoju polohu v kaviarni...");

  bool isAtCafe = await GpsService.isUserAtLocation(location, 50.0);
  
  if (!context.mounted) return;
  Navigator.pop(context); // Bezpečne zatvorí loading dialóg

  if (!isAtCafe) {
    // Používateľ nie je v podniku -> zastavujeme workflow
    _showErrorDialog(
      context, 
      "Chyba polohy 📍", 
      "Nachádzaš sa príliš ďaleko od tejto kaviarne. Musíš byť priamo na mieste do 50 metrov."
    );
    return;
  }

  // 2. KROK: GPS JE OK - Spúšťame Misiový fotoaparát
  final imagePath = await Navigator.push(
    context,
    MaterialPageRoute(builder: (context) => MissionCameraScreen(cafeName: name)),
  );

  if (imagePath == null || !context.mounted) return;

  // 3. KROK: FOTKA JE HOTOVÁ - Posielame na stiahnutý Gemini AI backend
  _showLoadingDialog(context, "Gemini AI analyzuje tvoj príspevok...");

  try {
    bool isApproved = await _verifyWithGeminiBackend(imagePath, name);
    
    if (!context.mounted) return;
    Navigator.pop(context); // Bezpečne zatvorí analyzačný dialóg

    if (isApproved) {
      // 4. KROK: ÚSPECH - Odmena pripísaná!
      setState(() {
        verifiedCafes[name] = true;
      });
      _showSuccessDialog(context, name);
    } else {
      // 4. KROK: NEÚSPECH - Nesprávny príspevok
      _showErrorDialog(
        context, 
        "Overenie zlyhalo ❌", 
        "Gemini nenašla na obrázku kávu, interiér, alebo chýba správne označenie podniku."
      );
    }
  } catch (e) {
    if (!context.mounted) return;
    Navigator.pop(context); // Vždy upratať loader
    _showErrorDialog(
      context, 
      "Chyba spojenia 🌐", 
      "Nepodarilo sa spojiť s overovacím serverom na porte 3000."
    );
  }
}

/// Pomocná asynchrónna funkcia na komunikáciu s lokálnym Node.js serverom
Future<bool> _verifyWithGeminiBackend(String imagePath, String cafeName) async {
  final bytes = await File(imagePath).readAsBytes();
  final base64Image = 'data:image/jpeg;base64,${base64Encode(bytes)}';
  final url = Uri.parse('http://10.0.2.2:3000/verify-mission');

  final response = await http.post(
    url,
    headers: {"Content-Type": "application/json"},
    body: jsonEncode({
      "imageBase64": base64Image, 
      "cafeName": cafeName
    }),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['approved'] == true;
  }
  return false;
}

/// Tmavý moderný loading dialóg
void _showLoadingDialog(BuildContext context, String message) {
  showDialog(
    context: context,
    barrierDismissible: false, // Používateľ nemôže dialóg zatvoriť kliknutím mimo okna
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      backgroundColor: const Color(0xFF1E1E1E), // Tmavé pozadie
      content: Row(
        children: [
          const CircularProgressIndicator(color: Color(0xFFFFD700)), // Zlatý indikátor
          const SizedBox(width: 20),
          Expanded(
            child: Text(
              message, 
              style: const TextStyle(color: Colors.white, fontSize: 14)
            )
          ),
        ],
      ),
    ),
  );
}

/// Elegantný dialóg pre zlyhanie alebo overovaciu chybu
void _showErrorDialog(BuildContext context, String title, String body) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      backgroundColor: const Color(0xFF1E1E1E),
      title: Text(
        title, 
        style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)
      ),
      content: Text(
        body, 
        style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context), 
          child: const Text("Rozumiem", style: TextStyle(color: Color(0xFFFFD700)))
        )
      ],
    ),
  );
}

/// Zlatý víťazný dialóg po úspešnom overení cez Gemini
void _showSuccessDialog(BuildContext context, String cafeName) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      backgroundColor: const Color(0xFF1E1E1E),
      title: const Text(
        "🎉 Úspech a odmena!", 
        style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)
      ),
      content: Text(
        "Gemini úspešne overila tvoj príspevok pre $cafeName. Odmena bola okamžite pripísaná do tvojej peňaženky!",
        style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context), 
          child: const Text("Skvelé", style: TextStyle(color: Color(0xFFFFD700), fontWeight: FontWeight.bold))
        )
      ],
    ),
  );
}
```

---

## 6. Správa odmien a Peňaženka (`WalletScreen`)

Pre komplexný finančný vhľad a možnosť spravovať zarobené odmeny a výplaty priamo v aplikácii, integrujeme obrazovku **Tvoja Peňaženka** spolu s tlačidlom pre rýchly prístup v hornom paneli (`AppBar`).

### 6.1. Kód Obrazovky Peňaženky (`wallet_screen.dart`)

Vytvorte nový súbor `wallet_screen.dart` s nasledovným widgetom:

```dart
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212), // Moderný tmavý režim pre prémiový finančný vzhľad
      appBar: AppBar(
        title: const Text(
          "Tvoja Peňaženka", 
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18)
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Sekcia s aktuálnym zostatkom
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32.0, horizontal: 24.0),
            child: Column(
              children: [
                Text(
                  "Aktuálny zostatok", 
                  style: TextStyle(color: Colors.grey, fontSize: 16)
                ),
                SizedBox(height: 8),
                Text(
                  "24,50 €", 
                  style: TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.bold)
                ),
              ],
            ),
          ),
          
          // Tlačidlo na výber peňazí na bankový účet
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFD700), // Zlatá dominantná farba
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  elevation: 2,
                ),
                onPressed: () => _showPayoutDialog(context),
                child: const Text(
                  "Vyplatiť na účet", 
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)
                ),
              ),
            ),
          ),
          
          const SizedBox(height: 40),
          
          // Nadpis pre históriu transakcií
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24.0),
            child: Row(
              children: [
                Icon(Icons.history, color: Colors.white55, size: 18),
                SizedBox(width: 8),
                Text(
                  "História odmien", 
                  style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 14)
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          
          // História transakcií z overených kaviarní
          Expanded(
            child: ListView(
              physics: const BouncingScrollPhysics(),
              children: [
                _buildTransaction("Café Wallner", "Dnes, 14:20", "+ 4,50 €"),
                _buildTransaction("Hofzuckerbäckerei", "Včera, 11:05", "+ 5,00 €"),
                _buildTransaction("Seecafe Hallstatt", "2. Jún, 16:40", "+ 3,50 €"),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Pomocný riadok pre transakciu v zozname
  Widget _buildTransaction(String title, String date, String amount) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 6.0),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(15),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
        leading: const CircleAvatar(
          backgroundColor: Colors.white12, 
          child: Icon(LucideIcons.coffee, color: Colors.white, size: 20)
        ),
        title: Text(
          title, 
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)
        ),
        subtitle: Text(
          date, 
          style: const TextStyle(color: Colors.grey, fontSize: 12)
        ),
        trailing: Text(
          amount, 
          style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 16)
        ),
      ),
    );
  }

  /// Spustenie vyplatenia s dialógom
  void _showPayoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          "Výplata peňazí 💶", 
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)
        ),
        content: const Text(
          "Tvoja odmena 24,50 € bude odoslaná na tvoj prepojený účet do 24 hodín.", 
          style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.4)
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: const Text("Zrušiť", style: TextStyle(color: Colors.grey))
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFFD700),
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Výplata úspešne zadaná!'),
                  backgroundColor: Colors.green,
                ),
              );
            }, 
            child: const Text("Potvrdiť", style: TextStyle(fontWeight: FontWeight.bold))
          ),
        ],
      ),
    );
  }
}
```

### 6.2. Integrácia Tlačidla na Peňaženku do Top Panela Mapy

Aby sa používatelia vedeli bezpečne a rýchlo prekliknúť do svojej peňaženky z hlavnej mapovej obrazovky `MapScreen` v súbore `main.dart`, pridajte akčné tlačidlo s krásnou Peňaženkovou ikonou do zoznamu `actions` v `AppBar`i:

```dart
// V hornej lište (AppBar) vo vašom main.dart pridajte do actions nasledovné:
appBar: AppBar(
  title: const Text("Salzkammergut Kaviarenské Misie", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
  backgroundColor: Colors.white,
  foregroundColor: Colors.brown,
  elevation: 0.5,
  actions: [
    if (_isAnalyzing)
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 16.0),
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.brown),
        ),
      ),
    IconButton(
      icon: const Icon(LucideIcons.wallet, color: Colors.brown), // Krásna ikona peňaženky
      tooltip: "Tvoja Peňaženka",
      onPressed: () {
        Navigator.push(
          context, 
          MaterialPageRoute(builder: (context) => const WalletScreen())
        );
      },
    ),
  ],
),
```

---

## 🚀 Prečo používať tento overovací Flow?

1. **Structured Outputs**: Express backend komunikuje so systémom **Gemini 3.5-flash** prostredníctvom oficiálne prísnych JSON schém.
2. **Robustný Failover**: React frontend pre simulované hovory obsahuje inteligentných náhradníkov (fallback), takže vaše lokálne testovacie prostredie nikdy "nezamrzne".
3. **Možnosť pridať Instagram screenshots**: Používateľ vie nahrať overený doplňujúci snímok s vyznačeným tagom priamo na hlavnej časovej osi pod mapou.

---

## ⚡ Tipy pre testovanie vo Flutteri

> [!TIP]
> **Hot Restart ("R") vo VS Code alebo Termináli**
> Keď prepíšete kód vo Flutteri, stlačte **"R" (veľké R)** v hernom/vývojovom termináli pre spustenie tzv. **Hot Restartu**. Obyčajný *Hot Reload (malé r)* totiž niekedy neobnoví mapové body, ktoré sú načítané vo vyrovnávacej pamäti služby OpenStreetMap/FlutterMap. Úplný reštart aplikácie bezpečne vykreslí všetky biele bublinky s cenami odmien a kávovými ikonkami na správnych miestach!
