import { HStack, Icon, Link, Text, useColorModeValue } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import type { IconType } from "react-icons";

interface NavLinkProps {
  name: string;
  path: string;
  onClose: () => void;
  icon?: IconType;
}

export default function NavLink({ name, path, onClose, icon: IconComponent }: NavLinkProps) {
  const muted = useColorModeValue("gray.600", "gray.400");
  const hoverColor = useColorModeValue("blue.500", "blue.200");

  return (
    <Link
      as={RouterLink}
      to={path}
      lineHeight="inherit"
      onClick={() => onClose()}
      textDecoration="none"
      _hover={{ textDecoration: "none" }}
    >
      <HStack spacing={2} as="span">
        {IconComponent ? (
          <Icon as={IconComponent} boxSize={3.5} color={muted} flexShrink={0} aria-hidden />
        ) : null}
        <Text
          color={muted}
          _hover={{
            textDecoration: "none",
            color: hoverColor
          }}
        >
          {name}
        </Text>
      </HStack>
    </Link>
  );
}
