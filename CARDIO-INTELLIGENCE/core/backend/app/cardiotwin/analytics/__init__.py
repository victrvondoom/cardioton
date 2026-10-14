"""CardioTwin Analytics Package."""

__all__ = ["CardioGlobalService"]


def __getattr__(name: str) -> object:
    if name == "CardioGlobalService":
        from app.cardiotwin.analytics.global_service import CardioGlobalService

        return CardioGlobalService
    raise AttributeError(name)
