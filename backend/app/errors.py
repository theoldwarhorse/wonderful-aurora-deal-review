"""What can go wrong with a request. The HTTP and MCP layers turn these into responses."""


class NotFound(Exception):
    pass


class Conflict(Exception):
    """The request is valid but the current state does not allow it."""


class Invalid(Exception):
    """The request itself is wrong."""
