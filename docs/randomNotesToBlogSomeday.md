# instr_timing

So I finally figured out my problem (documenting here in case anyone cares):

0xE0 (for example), is a load instruction that takes 12 cycles.

Bgb will premptively report the first 8 cycles, and then show the last 4 cycles. so if we had:

0xAF (xor a 4 cycles).
0xE0 0x05 (ld ff00+05 a 12 cycles).

When the PC is at 0xE0, it will report that the 0xAF took 12 cycles, because really it executed the 0xAF, but ran the 8 cycles from 0xE0 already. Thus, when you advance past 0xE0, 0xE0 will report only taking 4 cycles.

So in our implementation, whenever an opcode is incremented, we need to match this behavior, and add the cycles for the fetch of the next byte.

This also affect memory access. Thus you'd want to update everything, before allowing memory access to the memory location.
