import { Button, ButtonGroup, VisuallyHidden } from "@chakra-ui/react";
import { FaGithub, FaGoogle, FaTwitter } from "react-icons/fa";

const providers = [
  { name: "Google", icon: <FaGoogle /> },
  { name: "Twitter", icon: <FaTwitter /> },
  { name: "GitHub", icon: <FaGithub /> }
];

export const OAuthButtonGroup = () => (
  <ButtonGroup variant="secondary" spacing="4">
    {providers.map(({ name, icon }) => (
      <Button key={name} flexGrow={1}>
        <VisuallyHidden>Sign in with {name}</VisuallyHidden>
        {icon}
      </Button>
    ))}
  </ButtonGroup>
);
