(module
 (type $iv (func (param i32)))
 (type $i (func (result i32)))
 (global $wasm/index/test (mut i32) (i32.const 0))
 (global $HEAP_BASE i32 (i32.const 4))
 (memory $0 1)
 (export "init" (func $wasm/index/init))
 (export "storeTest" (func $wasm/index/storeTest))
 (export "loadTest" (func $wasm/index/loadTest))
 (export "memory" (memory $0))
 (func $wasm/index/init (; 0 ;) (type $iv) (param $0 i32)
  (set_global $wasm/index/test
   (get_local $0)
  )
 )
 (func $wasm/index/storeTest (; 1 ;) (type $i) (result i32)
  (i32.store
   (i32.const 0)
   (get_global $wasm/index/test)
  )
  (return
   (i32.add
    (get_global $wasm/index/test)
    (i32.const 10)
   )
  )
 )
 (func $wasm/index/loadTest (; 2 ;) (type $i) (result i32)
  (return
   (i32.load
    (i32.const 4)
   )
  )
 )
)
