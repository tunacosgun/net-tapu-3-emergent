#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(LiquidGlassViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(activeIndex, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(tabCount, NSInteger)

@end
