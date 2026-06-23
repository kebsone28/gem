module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@config': './src/config',
          '@services': './src/services',
          '@screens': './src/screens',
          '@components': './src/components',
          '@types': './src/types',
          '@utils': './src/utils',
        },
      },
    ],
  ],
};
