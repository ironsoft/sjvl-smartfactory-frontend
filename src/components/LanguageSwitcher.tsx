// src/components/LanguageSwitcher.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuButton, MenuList, MenuItem, Button } from '@chakra-ui/react';
import { FaGlobe } from 'react-icons/fa';


const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
  };

  return (
    <Menu>
      <MenuButton variant={"ghost"} as={Button} rightIcon={<FaGlobe />}>
        {i18n.language ? i18n.language.toUpperCase() : ''}
      </MenuButton>
      <MenuList>
        <MenuItem onClick={() => changeLanguage('en')}>English</MenuItem>
        <MenuItem onClick={() => changeLanguage('ko')}>한국어</MenuItem>
        <MenuItem onClick={() => changeLanguage('vi')}>Tiếng Việt</MenuItem>
      </MenuList>
    </Menu>
  );
};

export default LanguageSwitcher;
