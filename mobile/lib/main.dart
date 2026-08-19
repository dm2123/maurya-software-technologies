import 'package:flutter/material.dart';

import 'state/app_state.dart';
import 'theme.dart';
import 'screens/home_screen.dart';
import 'screens/editor_screen.dart';
import 'screens/runner_screen.dart';
import 'screens/cloud_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/about_screen.dart';
import 'screens/products_screen.dart';
import 'screens/services_screen.dart';
import 'screens/downloads_screen.dart';
import 'screens/privacy_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await appState.init();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Maurya Automation',
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        home: const HomeScreen(),
        routes: {
          '/editor': (c) => const EditorScreen(),
          '/runner': (c) => const RunnerScreen(),
          '/cloud': (c) => const CloudScreen(),
          '/settings': (c) => const SettingsScreen(),
          '/about': (c) => const AboutScreen(),
          '/products': (c) => const ProductsScreen(),
          '/services': (c) => const ServicesScreen(),
          '/downloads': (c) => const DownloadsScreen(),
          '/privacy': (c) => const PrivacyScreen(),
        },
      );
}
