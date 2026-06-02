import { HStack, Icon, MenuItem, Text, useColorModeValue } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import type { IconType } from "react-icons";

interface MenuLinkProps {
  name: string;
  path: string;
  onClose: () => void;
  icon?: IconType;
}

export default function MenuLink({ name, path, onClose, icon: IconComponent }: MenuLinkProps) {
  const muted = useColorModeValue("gray.600", "gray.400");
  const hoverBg = useColorModeValue("gray.200", "gray.700");

  return (
    <MenuItem
      as={RouterLink}
      to={path}
      onClick={() => onClose()}
      _hover={{
        color: "blue.400",
        bg: hoverBg,
      }}
    >
      <HStack spacing={2}>
        {IconComponent ? (
          <Icon as={IconComponent} boxSize={3} color={muted} flexShrink={0} aria-hidden />
        ) : null}
        <Text fontSize="sm" color={muted}>{name}</Text>
      </HStack>
    </MenuItem>
  );
}
